import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book } from "../../index.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-branch-test-"));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("branch operations", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Branch Novel", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("seeds main branch as current by default", () => {
    const current = book.getCurrentBranch();
    expect(current.id).toBe("main");
    expect(current.current).toBe(true);

    const branches = book.listBranches();
    expect(branches).toHaveLength(1);
    expect(branches[0].id).toBe("main");
  });

  it("forks a branch and copies graph/text state", async () => {
    const chapterPath = path.join(book.paths.chaptersDir, "0001.md");
    await fs.mkdir(book.paths.chaptersDir, { recursive: true });
    await fs.writeFile(chapterPath, "# Chapter 1\n\nOriginal text.", "utf-8");

    const branch = await book.forkBranch("feature");

    expect(branch.id).toMatch(/^branch-\d+-/);
    expect(branch.name).toBe("feature");
    expect(branch.current).toBe(false);

    expect(book.getCurrentBranch().id).toBe("main");

    const branches = book.listBranches();
    expect(branches).toHaveLength(2);
    expect(branches.map((b) => b.name)).toContain("feature");

    const branchGraphDb = path.join(book.paths.branchesDir, branch.id, "graph.db");
    expect(await fileExists(branchGraphDb)).toBe(true);
    const branchTextPath = path.join(book.paths.branchesDir, branch.id, "text", "chapters", "0001.md");
    expect(await fileExists(branchTextPath)).toBe(true);
  });

  it("checkout switches current branch and restores fork state", async () => {
    const branch = await book.forkBranch("feature");

    await fs.writeFile(
      path.join(book.paths.chaptersDir, "main-only.md"),
      "Main only",
      "utf-8"
    );
    book.store.createNode({
      id: "main-only-node",
      bookId: book.id,
      type: "note",
      label: "main only note",
      contentUri: null,
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await book.checkoutBranch(branch.id);
    book.close();

    const reopened = await Book.open(projectRoot, book.id);
    try {
      expect(reopened.getCurrentBranch().id).toBe(branch.id);
      expect(reopened.store.getNode(reopened.id, "main-only-node")).toBeUndefined();
      expect(await fileExists(path.join(reopened.paths.chaptersDir, "main-only.md"))).toBe(false);
    } finally {
      reopened.close();
    }
  });

  it("mergeBranches proposes creating a node added in source branch", async () => {
    const branch = await book.forkBranch("feature");

    await book.checkoutBranch(branch.id);
    book.close();

    const featureBook = await Book.open(projectRoot, book.id);
    try {
      featureBook.store.createNode({
        id: "feature-only",
        bookId: featureBook.id,
        type: "note",
        label: "feature note",
        contentUri: null,
        properties: { tag: "feature" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      featureBook.store.createEdge({
        id: `edge-feature-only`,
        bookId: featureBook.id,
        type: "contains",
        fromId: "book",
        toId: "feature-only",
        properties: {},
        createdAt: new Date().toISOString(),
      });
    } finally {
      featureBook.close();
    }

    const tempBook = await Book.open(projectRoot, book.id);
    try {
      await tempBook.checkoutBranch("main");
    } finally {
      tempBook.close();
    }

    const mainBook = await Book.open(projectRoot, book.id);
    try {
      const proposal = await mainBook.mergeBranches(branch.id);
      expect(proposal.sourceBranchId).toBe(branch.id);
      expect(proposal.targetBranchId).toBe("main");
      expect(proposal.operations).toHaveLength(1);
      expect(proposal.operations[0]).toMatchObject({
        op: "create",
        path: "feature-only",
        nodeType: "note",
        properties: { tag: "feature" },
      });
      expect(proposal.conflicts).toHaveLength(0);
    } finally {
      mainBook.close();
    }
  });
});
