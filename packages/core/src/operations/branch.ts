import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Book } from "../models/book.js";
import { GraphStore } from "../graph/store.js";
import type { Branch, GraphEdge, GraphNode } from "../graph/types.js";
import type { PatchOperation } from "./types.js";
import { logOperation } from "./logger.js";

export interface MergeConflict {
  nodeId: string;
  kind: "node";
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
}

export interface MergeProposal {
  id: string;
  description: string;
  sourceBranchId: string;
  targetBranchId: string;
  operations: PatchOperation[];
  conflicts: MergeConflict[];
}

function generateBranchId(): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `branch-${Date.now()}-${suffix}`;
}

function now(): string {
  return new Date().toISOString();
}

function checkpoint(book: Book): void {
  book.store.prepare("PRAGMA wal_checkpoint(FULL)").run();
}

async function copyDirectory(src: string, dest: string, excludeDirName: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === excludeDirName) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, excludeDirName);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.rm(filePath, { recursive: true, force: true });
  } catch {
    // Ignore if the path does not exist.
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function saveBranchState(book: Book, branchId: string): Promise<void> {
  const branchDir = path.join(book.paths.branchesDir, branchId);
  await removeIfExists(branchDir);
  await copyDirectory(book.paths.root, branchDir, "branches");
}

function ensureMainBranch(book: Book): Branch {
  const existing = book.store.getCurrentBranch(book.id);
  if (existing) {
    return existing;
  }

  const branches = book.store.listBranches(book.id);
  const main = branches.find((b) => b.id === "main");
  if (main) {
    book.store.setBranchCurrent(book.id, "main");
    return { ...main, current: true };
  }

  const seed: Branch = {
    id: "main",
    bookId: book.id,
    name: "main",
    sourceBranchId: null,
    sourceSnapshotId: null,
    headSnapshotId: null,
    current: true,
    createdAt: now(),
  };
  book.store.createBranch(seed);
  return seed;
}

export function getCurrentBranch(book: Book): Branch {
  return ensureMainBranch(book);
}

export function listBranches(book: Book): Branch[] {
  ensureMainBranch(book);
  return book.store.listBranches(book.id);
}

export async function forkBranch(book: Book, name: string): Promise<Branch> {
  const currentBranch = ensureMainBranch(book);
  checkpoint(book);

  const snapshotId = await book.snapshot(`fork from ${currentBranch.name}`);
  if (currentBranch.headSnapshotId !== snapshotId) {
    book.store.updateBranchHead(book.id, currentBranch.id, snapshotId);
  }

  const branchId = generateBranchId();
  const branchDir = path.join(book.paths.branchesDir, branchId);
  await fs.mkdir(branchDir, { recursive: true });

  const branch: Branch = {
    id: branchId,
    bookId: book.id,
    name,
    sourceBranchId: currentBranch.id,
    sourceSnapshotId: snapshotId,
    headSnapshotId: snapshotId,
    current: false,
    createdAt: now(),
  };
  book.store.createBranch(branch);

  await copyDirectory(book.paths.root, branchDir, "branches");
  await saveBranchState(book, "main");

  logOperation(book, "forkBranch", branchId, {
    name,
    sourceBranchId: currentBranch.id,
    sourceSnapshotId: snapshotId,
  });

  return branch;
}

export async function checkoutBranch(book: Book, branchId: string): Promise<Branch> {
  ensureMainBranch(book);

  const branch = book.store.listBranches(book.id).find((b) => b.id === branchId);
  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const branchDir = path.join(book.paths.branchesDir, branchId);
  if (!(await directoryExists(branchDir))) {
    throw new Error(`Branch data not found at ${branchDir}`);
  }

  const branchMetadata = book.store.listBranches(book.id);
  const currentBranch = book.store.getCurrentBranch(book.id);
  if (currentBranch && currentBranch.id !== branchId) {
    await saveBranchState(book, currentBranch.id);
  }

  checkpoint(book);
  logOperation(book, "checkoutBranch", branchId, { name: branch.name });
  book.store.close();

  const walPath = `${book.paths.graphDb}-wal`;
  const shmPath = `${book.paths.graphDb}-shm`;
  await removeIfExists(walPath);
  await removeIfExists(shmPath);

  await removeIfExists(book.paths.graphDb);
  await removeIfExists(book.paths.textDir);
  await removeIfExists(book.paths.projectionsDir);
  await removeIfExists(book.paths.snapshotsDir);

  await copyDirectory(branchDir, book.paths.root, "branches");

  const tempStore = new GraphStore(book.paths.graphDb);
  try {
    tempStore.prepare("DELETE FROM branches").run();
    for (const row of branchMetadata) {
      tempStore.createBranch({
        ...row,
        current: row.id === branchId,
      });
    }
  } finally {
    tempStore.close();
  }

  return { ...branch, current: true };
}

function findParentId(store: GraphStore, bookId: string, nodeId: string): string {
  const edges = store.findEdges({ bookId, toId: nodeId, type: "contains" });
  return edges[0]?.fromId ?? "book";
}

function buildCreateOperation(node: GraphNode, parentId: string): PatchOperation {
  const path = parentId === "book" ? node.id : `${parentId}/${node.id}`;
  return {
    op: "create",
    path,
    nodeType: node.type,
    properties: { ...node.properties },
  };
}

function diffProperties(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> | undefined {
  const diff: Record<string, unknown> = {};
  let hasDiff = false;

  for (const [key, value] of Object.entries(source)) {
    if (JSON.stringify(target[key]) !== JSON.stringify(value)) {
      diff[key] = value;
      hasDiff = true;
    }
  }

  return hasDiff ? diff : undefined;
}

export async function mergeBranches(book: Book, sourceBranchId: string): Promise<MergeProposal> {
  const targetBranch = ensureMainBranch(book);

  const sourceBranch = book.store.listBranches(book.id).find((b) => b.id === sourceBranchId);
  if (!sourceBranch) {
    throw new Error(`Source branch not found: ${sourceBranchId}`);
  }

  const sourceGraphDb = path.join(book.paths.branchesDir, sourceBranchId, "graph.db");
  if (!(await directoryExists(path.dirname(sourceGraphDb)))) {
    throw new Error(`Source branch data not found: ${sourceBranchId}`);
  }

  const sourceStore = new GraphStore(sourceGraphDb);
  try {
    const currentNodes = book.store.findNodes({ bookId: book.id });
    const sourceNodes = sourceStore.findNodes({ bookId: book.id });

    const currentMap = new Map(currentNodes.map((n) => [n.id, n]));
    const sourceMap = new Map(sourceNodes.map((n) => [n.id, n]));

    const operations: PatchOperation[] = [];
    const conflicts: MergeConflict[] = [];

    for (const sourceNode of sourceNodes) {
      const currentNode = currentMap.get(sourceNode.id);
      if (!currentNode) {
        const parentId = findParentId(sourceStore, book.id, sourceNode.id);
        operations.push(buildCreateOperation(sourceNode, parentId));
        continue;
      }

      if (currentNode.label !== sourceNode.label) {
        conflicts.push({
          nodeId: sourceNode.id,
          kind: "node",
          field: "label",
          sourceValue: sourceNode.label,
          targetValue: currentNode.label,
        });
      }

      if (currentNode.contentUri !== sourceNode.contentUri) {
        conflicts.push({
          nodeId: sourceNode.id,
          kind: "node",
          field: "contentUri",
          sourceValue: sourceNode.contentUri,
          targetValue: currentNode.contentUri,
        });
      }

      const propertyDiff = diffProperties(sourceNode.properties, currentNode.properties);
      if (propertyDiff) {
        operations.push({
          op: "update",
          path: sourceNode.id,
          properties: propertyDiff,
        });
      }
    }

    operations.sort((a, b) => a.path.split("/").length - b.path.split("/").length);

    return {
      id: `merge-${Date.now()}`,
      description: `Merge proposal from ${sourceBranch.name} into ${targetBranch.name}`,
      sourceBranchId,
      targetBranchId: targetBranch.id,
      operations,
      conflicts,
    };
  } finally {
    sourceStore.close();
  }
}
