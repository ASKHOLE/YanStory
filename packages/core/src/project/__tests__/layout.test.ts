import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book } from "../../index.js";
import { ensureProjectLayout, ensureBookLayout, listBooks, bookExists } from "../layout.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-layout-test-"));
}

describe("project layout", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await createTempDir();
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("creates project layout directories", async () => {
    await ensureProjectLayout(projectRoot);
    const yanstoryDir = path.join(projectRoot, ".yanstory");
    const booksDir = path.join(projectRoot, "books");
    expect((await fs.stat(yanstoryDir)).isDirectory()).toBe(true);
    expect((await fs.stat(booksDir)).isDirectory()).toBe(true);
  });

  it("creates book layout directories", async () => {
    const paths = await ensureBookLayout(projectRoot, "book-1");
    expect((await fs.stat(paths.chaptersDir)).isDirectory()).toBe(true);
    expect((await fs.stat(paths.projectionsDir)).isDirectory()).toBe(true);
    expect((await fs.stat(paths.snapshotsDir)).isDirectory()).toBe(true);
  });

  it("lists books with metadata", async () => {
    const book = await Book.create({ projectRoot, title: "Listed Book", genre: "wuxia" });
    book.close();

    const books = await listBooks(projectRoot);
    expect(books.length).toBe(1);
    expect(books[0].id).toBe(book.id);
    expect(books[0].title).toBe("Listed Book");
    expect(books[0].genre).toBe("wuxia");
  });

  it("returns empty list when no books exist", async () => {
    await ensureProjectLayout(projectRoot);
    const books = await listBooks(projectRoot);
    expect(books).toEqual([]);
  });

  it("returns empty list when books directory does not exist", async () => {
    const books = await listBooks(projectRoot);
    expect(books).toEqual([]);
  });

  it("checks book existence", async () => {
    const book = await Book.create({ projectRoot, title: "Existing", genre: "general" });
    expect(await bookExists(projectRoot, book.id)).toBe(true);
    expect(await bookExists(projectRoot, "missing-book")).toBe(false);
    book.close();
  });
});
