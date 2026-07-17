import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Book } from "../models/book.js";
import type { GraphNode, NodeType } from "../graph/types.js";
import type { PatchOperation, PatchProposal } from "./types.js";
import { logOperation } from "./logger.js";

export interface ApplyPatchOptions {
  proposal: PatchProposal;
}

export interface ApplyPatchResult {
  applied: number;
}

export async function applyPatch(book: Book, options: ApplyPatchOptions): Promise<ApplyPatchResult> {
  let applied = 0;

  for (const operation of options.proposal.operations) {
    await applyOperation(book, operation);
    applied++;
  }

  await regenerateChapterMarkdowns(book);

  logOperation(book, "applyPatch", null, {
    patchId: options.proposal.id,
    operations: options.proposal.operations.length,
  });

  return { applied };
}

async function applyOperation(book: Book, operation: PatchOperation): Promise<void> {
  const segments = operation.path.split("/").filter(Boolean);
  const nodeId = segments.join("/");

  switch (operation.op) {
    case "create": {
      const parentId = segments.slice(0, -1).join("/") || "book";
      const now = new Date().toISOString();
      const existing = book.store.getNode(book.id, nodeId);
      if (existing) {
        throw new Error(`Cannot create node, already exists: ${nodeId}`);
      }
      book.store.createNode({
        id: nodeId,
        bookId: book.id,
        type: ((operation.nodeType as NodeType) ?? "paragraph") as NodeType,
        label: nodeId,
        contentUri: null,
        properties: operation.properties ?? {},
        createdAt: now,
        updatedAt: now,
      });
      book.store.createEdge({
        id: randomUUID(),
        bookId: book.id,
        type: "contains",
        fromId: parentId,
        toId: nodeId,
        properties: {},
        createdAt: now,
      });
      return;
    }
    case "update": {
      const node = book.resolver.resolveSingle(book.id, operation.path);
      if (!node) {
        throw new Error(`Cannot update node, not found: ${operation.path}`);
      }
      book.store.updateNode(book.id, node.id, {
        properties: operation.properties ? { ...node.properties, ...operation.properties } : undefined,
      });
      return;
    }
    case "delete": {
      const node = book.resolver.resolveSingle(book.id, operation.path);
      if (!node) {
        throw new Error(`Cannot delete node, not found: ${operation.path}`);
      }
      book.store.deleteNode(book.id, node.id);
      return;
    }
    default:
      throw new Error(`Unsupported patch operation: ${(operation as PatchOperation).op}`);
  }
}

async function regenerateChapterMarkdowns(book: Book): Promise<void> {
  const chapters = book.store.findNodes({ bookId: book.id, type: "chapter" });
  for (const chapter of chapters) {
    if (!chapter.contentUri) continue;

    const chapterNumber = Number(chapter.properties.chapterNumber ?? 0);
    const lines: string[] = [`# ${book.getNode("book")?.label ?? "Untitled"} - Chapter ${chapterNumber}`];

    const scenes = book.store
      .findNodes({ bookId: book.id, parentId: chapter.id, type: "scene" })
      .sort((a, b) => Number(a.properties.sceneNumber ?? 0) - Number(b.properties.sceneNumber ?? 0));

    for (const scene of scenes) {
      const paragraphs = book.store
        .findNodes({ bookId: book.id, parentId: scene.id, type: "paragraph" })
        .sort((a, b) => Number(a.properties.paragraphNumber ?? 0) - Number(b.properties.paragraphNumber ?? 0));

      for (const paragraph of paragraphs) {
        const text = (paragraph.properties.text as string) ?? "";
        if (text) lines.push(text);
      }
    }

    const filePath = path.join(book.paths.root, chapter.contentUri);
    await fs.writeFile(filePath, lines.join("\n\n"), "utf-8");
  }
}
