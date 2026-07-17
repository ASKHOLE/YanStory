import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import type { Book } from "../models/book.js";
import { logOperation } from "./logger.js";

export async function snapshot(book: Book, name: string): Promise<string> {
  const now = new Date().toISOString();
  const snapshotId = randomUUID();

  // Ensure WAL is checkpointed so the snapshot captures the latest state.
  book.store.prepare("PRAGMA wal_checkpoint(FULL)").run();

  const snapshotDir = path.join(book.paths.snapshotsDir, snapshotId);
  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.copyFile(book.paths.graphDb, path.join(snapshotDir, "graph.db"));

  book.store.createSnapshot({
    id: snapshotId,
    bookId: book.id,
    name,
    graphHash: null,
    createdAt: now,
  });

  logOperation(book, "snapshot", null, { snapshotId, name });
  return snapshotId;
}

export async function restoreSnapshot(book: Book, snapshotId: string): Promise<void> {
  const snapshots = book.store.listSnapshots(book.id);
  const target = snapshots.find((s) => s.id === snapshotId);
  if (!target) {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  // MVP restore: copy the entire graph.db from a stored snapshot file if it exists.
  const snapshotDir = path.join(book.paths.snapshotsDir, snapshotId);
  const snapshotDbPath = path.join(snapshotDir, "graph.db");

  if (!(await fileExists(snapshotDbPath))) {
    throw new Error(`Snapshot data not found at ${snapshotDbPath}`);
  }

  book.store.close();

  // Remove stale WAL files so the restored main DB is not overwritten on open.
  const walPath = `${book.paths.graphDb}-wal`;
  const shmPath = `${book.paths.graphDb}-shm`;
  await deleteIfExists(walPath);
  await deleteIfExists(shmPath);

  await fs.copyFile(snapshotDbPath, book.paths.graphDb);
}

async function deleteIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if file does not exist.
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
