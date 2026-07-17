import path from "node:path";
import fs from "node:fs/promises";
import { GraphStore } from "../graph/store.js";
import { bookExists, getBookPaths } from "./layout.js";

export async function exportBook(projectRoot: string, bookId: string, targetDir: string): Promise<void> {
  const source = getBookPaths(projectRoot, bookId).root;
  if (!(await bookExists(projectRoot, bookId))) {
    throw new Error(`Book not found: ${bookId}`);
  }
  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(source, targetDir, { recursive: true, force: true });
}

export async function importBook(projectRoot: string, sourceDir: string): Promise<string> {
  const resolvedSource = path.resolve(sourceDir);
  const sourceGraphDb = path.join(resolvedSource, "graph.db");
  try {
    const stat = await fs.stat(sourceGraphDb);
    if (!stat.isFile()) {
      throw new Error(`Source is missing graph.db: ${sourceDir}`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Source is missing graph.db: ${sourceDir}`);
    }
    throw error;
  }

  let bookId: string;
  const tempStore = new GraphStore(sourceGraphDb);
  try {
    const row = tempStore.prepare("SELECT book_id FROM nodes WHERE type = 'book' LIMIT 1").get() as
      | { book_id: string }
      | undefined;
    if (!row) {
      throw new Error(`Source graph has no book node: ${sourceDir}`);
    }
    bookId = row.book_id;
  } finally {
    tempStore.close();
  }

  if (await bookExists(projectRoot, bookId)) {
    throw new Error(
      `Book ${bookId} already exists in project. Remove it first or choose a different directory name.`
    );
  }

  const target = getBookPaths(projectRoot, bookId).root;
  await fs.mkdir(target, { recursive: true });
  await fs.cp(resolvedSource, target, { recursive: true, force: true });
  return bookId;
}
