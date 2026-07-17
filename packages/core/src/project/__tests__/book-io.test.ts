import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, LLMStub } from "../../index.js";
import { exportBook, importBook } from "../book-io.js";
import { bookExists, getProjectPaths } from "../layout.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-book-io-test-"));
}

describe("book export and import", () => {
  let projectRoot: string;
  let exportDir: string;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    exportDir = path.join(projectRoot, "exported");
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("exports a book directory", async () => {
    const book = await Book.create({ projectRoot, title: "Export Novel", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/.*/, "Export test content.");
    book.setLLMClient((options) => stub.call(options));
    await book.compose({ intent: "test", targetWords: 100 });
    book.close();

    await exportBook(projectRoot, book.id, exportDir);
    const graphDb = path.join(exportDir, "graph.db");
    const textDir = path.join(exportDir, "text", "chapters");
    expect((await fs.stat(graphDb)).isFile()).toBe(true);
    expect((await fs.stat(textDir)).isDirectory()).toBe(true);
  });

  it("throws when exporting a non-existent book", async () => {
    await expect(exportBook(projectRoot, "missing-book", exportDir)).rejects.toThrow("Book not found");
  });

  it("imports an exported book", async () => {
    const book = await Book.create({ projectRoot, title: "Import Novel", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/.*/, "Import test content.");
    book.setLLMClient((options) => stub.call(options));
    await book.compose({ intent: "test", targetWords: 100 });
    book.close();

    await exportBook(projectRoot, book.id, exportDir);

    const importRoot = await createTempDir();
    try {
      const importedId = await importBook(importRoot, exportDir);
      expect(importedId).toBe(book.id);
      expect(await bookExists(importRoot, importedId)).toBe(true);

      const importedBook = await Book.open(importRoot, importedId);
      const paragraph = importedBook.resolver.resolveSingle(importedBook.id, "chapter-0001/scene-1/paragraph-1");
      expect(paragraph?.properties.text).toContain("Import test content");
      importedBook.close();
    } finally {
      await fs.rm(importRoot, { recursive: true, force: true });
    }
  });

  it("throws when importing over an existing book", async () => {
    const book = await Book.create({ projectRoot, title: "Duplicate", genre: "xuanhuan" });
    await exportBook(projectRoot, book.id, exportDir);
    book.close();

    await expect(importBook(projectRoot, exportDir)).rejects.toThrow("already exists");
  });

  it("throws when source is missing graph.db", async () => {
    const emptyDir = path.join(projectRoot, "empty");
    await fs.mkdir(emptyDir, { recursive: true });
    await expect(importBook(projectRoot, emptyDir)).rejects.toThrow("missing graph.db");
  });
});
