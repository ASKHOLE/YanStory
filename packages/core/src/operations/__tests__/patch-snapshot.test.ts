import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, createLLMStub, LLMStub } from "../../index.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-patch-test-"));
}

describe("Patch application", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Patch Novel", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/.*/, "Line one.\n\nLine two.");
    book.setLLMClient((options) => stub.call(options));
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("applies an update patch and regenerates markdown", async () => {
    const composeResult = await book.compose({ intent: "test", targetWords: 100 });
    const original = await fs.readFile(composeResult.contentPath, "utf-8");
    const modified = original.replace("Line one", "Line one modified");
    await fs.writeFile(composeResult.contentPath, modified, "utf-8");

    const proposal = await book.proposePatch();
    expect(proposal.operations.length).toBeGreaterThan(0);

    const result = await book.applyPatch(proposal);
    expect(result.applied).toBe(proposal.operations.length);

    const paragraph = book.resolver.resolveSingle(book.id, "chapter-0001/scene-1/paragraph-1");
    expect(paragraph?.properties.text).toContain("Line one modified");

    const regenerated = await fs.readFile(composeResult.contentPath, "utf-8");
    expect(regenerated).toContain("Line one modified");
  });

  it("applies a create patch for a new paragraph", async () => {
    await book.compose({ intent: "test", targetWords: 100 });
    const chapterPath = path.join(book.paths.chaptersDir, "chapter-0001.md");
    const original = await fs.readFile(chapterPath, "utf-8");
    const modified = `${original}\n\nLine three.`;
    await fs.writeFile(chapterPath, modified, "utf-8");

    const proposal = await book.proposePatch();
    const createOps = proposal.operations.filter((op) => op.op === "create");
    expect(createOps.length).toBeGreaterThan(0);

    await book.applyPatch(proposal);
    const paragraphs = book.store.findNodes({ bookId: book.id, type: "paragraph" });
    expect(paragraphs.length).toBe(3);
  });

  it("applies a delete patch for a removed paragraph", async () => {
    await book.compose({ intent: "test", targetWords: 100 });
    const chapterPath = path.join(book.paths.chaptersDir, "chapter-0001.md");
    const original = await fs.readFile(chapterPath, "utf-8");
    const lines = original.split("\n\n");
    const modified = lines.slice(0, 2).join("\n\n");
    await fs.writeFile(chapterPath, modified, "utf-8");

    const proposal = await book.proposePatch();
    const deleteOps = proposal.operations.filter((op) => op.op === "delete");
    expect(deleteOps.length).toBeGreaterThan(0);

    await book.applyPatch(proposal);
    const paragraphs = book.store.findNodes({ bookId: book.id, type: "paragraph" });
    expect(paragraphs.length).toBe(1);
  });
});

describe("Snapshot create and restore", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Snapshot Novel", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/You are writing chapter/, "Snapshot test content.");
    stub.when(/Operation: soften/, "Softened snapshot test content.");
    book.setLLMClient((options) => stub.call(options));
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("creates a snapshot that copies graph.db", async () => {
    await book.compose({ intent: "test", targetWords: 100 });
    const snapshotId = await book.snapshot("manual-test");

    const snapshots = book.store.listSnapshots(book.id);
    expect(snapshots.some((s) => s.id === snapshotId)).toBe(true);

    const snapshotDbPath = path.join(book.paths.snapshotsDir, snapshotId, "graph.db");
    expect((await fs.stat(snapshotDbPath)).isFile()).toBe(true);
  });

  it("auto-creates snapshots after compose and edit", async () => {
    await book.compose({ intent: "test", targetWords: 100 });
    const afterCompose = book.store.listSnapshots(book.id).length;
    expect(afterCompose).toBeGreaterThan(0);

    await book.edit({ target: "chapter-0001/scene-1/paragraph-1", operation: "soften" });
    const afterEdit = book.store.listSnapshots(book.id).length;
    expect(afterEdit).toBeGreaterThan(afterCompose);
  });

  it("restores a snapshot", async () => {
    await book.compose({ intent: "introduce protagonist", targetWords: 100 });
    const snapshotId = await book.snapshot("before-edit");

    await book.edit({ target: "chapter-0001/scene-1/paragraph-1", operation: "soften" });
    const editedParagraph = book.resolver.resolveSingle(book.id, "chapter-0001/scene-1/paragraph-1");
    const editedText = editedParagraph?.properties.text as string;

    await book.restoreSnapshot(snapshotId);
    // The original book instance is closed after restore; reopen to verify.
    const restoredBook = await Book.open(projectRoot, book.id);
    const restoredParagraph = restoredBook.resolver.resolveSingle(restoredBook.id, "chapter-0001/scene-1/paragraph-1");
    expect(restoredParagraph?.properties.text).not.toBe(editedText);
    expect(restoredParagraph?.properties.text).toContain("Snapshot test content");
    restoredBook.close();
  });
});
