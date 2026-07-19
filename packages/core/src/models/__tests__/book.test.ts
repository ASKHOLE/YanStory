import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, createLLMStub, LLMStub, createHashEmbeddingProvider } from "../../index.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-test-"));
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

describe("Book live-artifact flow", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Test Novel", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/introduce protagonist/, [
      "The wind howled through the cursed academy halls.",
      "Elara pulled her cloak tighter, wondering if she had made a terrible mistake.",
      "Behind her, the gates slammed shut with a sound like finality.",
    ].join("\n\n"));
    stub.when(/soften/, "Elara pulled her cloak tighter, uncertain but determined.");
    book.setLLMClient((options) => stub.call(options));
  });

  afterEach(async () => {
    book.close();
    await removeDir(projectRoot);
  });

  it("creates a book with containers", async () => {
    const bookNode = book.getNode("book");
    expect(bookNode).toBeDefined();
    expect(bookNode?.label).toBe("Test Novel");
    expect(bookNode?.properties.genre).toBe("xuanhuan");

    const characters = book.store.findNodes({ bookId: book.id, type: "note", label: "characters" });
    expect(characters.length).toBe(1);
  });

  it("composes a chapter and persists markdown", async () => {
    const result = await book.compose({ intent: "introduce protagonist", targetWords: 100 });
    expect(result.node.type).toBe("chapter");
    expect(result.wordCount).toBeGreaterThan(0);

    const chapters = book.query({ type: "chapters" });
    expect((await chapters).items.length).toBe(1);

    const content = await fs.readFile(result.contentPath, "utf-8");
    expect(content).toContain("Chapter 1");
    expect(content).toContain("cursed academy");
  });

  it("queries the state graph", async () => {
    await book.compose({ intent: "introduce protagonist", targetWords: 100 });
    const result = await book.query({ type: "children", filters: { parent: "chapter-0001" } });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("edits a paragraph", async () => {
    await book.compose({ intent: "introduce protagonist", targetWords: 100 });
    const editResult = await book.edit({
      target: "chapter-0001/scene-1/paragraph-2",
      operation: "soften",
    });
    expect(editResult.node.properties.text).toContain("uncertain");
  });

  it("builds a projection", async () => {
    await book.compose({ intent: "introduce protagonist", targetWords: 100 });
    const projection = await book.projection();
    expect(projection).toContain("Chapter 1");
    expect(projection).toContain("cursed academy");
  });

  it("proposes a patch after markdown edit", async () => {
    const composeResult = await book.compose({ intent: "introduce protagonist", targetWords: 100 });
    const original = await fs.readFile(composeResult.contentPath, "utf-8");
    const modified = original.replace("cursed academy", "haunted academy");
    await fs.writeFile(composeResult.contentPath, modified, "utf-8");

    const proposal = await book.proposePatch();
    expect(proposal.operations.length).toBeGreaterThan(0);
    expect(proposal.operations.some((op) => String(op.properties?.text ?? "").includes("haunted"))).toBe(true);
  });
});

describe("Book embedding lifecycle", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Embed Test", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await removeDir(projectRoot);
  });

  it("stores embeddings with the provider model identifier", async () => {
    book.setEmbeddingProvider(createHashEmbeddingProvider(384));
    await book.ensureEmbeddings();

    const record = book.getEmbeddingStore()?.get(book.id, "book");
    expect(record).toBeDefined();
    expect(record?.model).toBe("hash");
    expect(record?.vector.length).toBe(384);
  });

  it("recomputes embeddings when dimension changes", async () => {
    book.setEmbeddingProvider(createHashEmbeddingProvider(384));
    await book.ensureEmbeddings();
    expect(book.getEmbeddingStore()?.get(book.id, "book")?.vector.length).toBe(384);

    book.setEmbeddingProvider(createHashEmbeddingProvider(128));
    await book.ensureEmbeddings();
    expect(book.getEmbeddingStore()?.get(book.id, "book")?.vector.length).toBe(128);
  });
});
