import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, createHashEmbeddingProvider, createLLMStub, LLMStub } from "../../index.js";
import { buildRetrievalContext } from "../retrieval.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-retrieval-test-"));
}

describe("buildRetrievalContext", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Test Novel", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("returns empty string when no embedding provider is configured", async () => {
    const context = await buildRetrievalContext(book, { queryText: "protagonist" });
    expect(context).toBe("");
  });

  it("retrieves relevant character nodes", async () => {
    book.setEmbeddingProvider(createHashEmbeddingProvider(64));

    const now = new Date().toISOString();
    book.store.createNode({
      id: "character/elara",
      bookId: book.id,
      type: "character",
      label: "Elara",
      contentUri: null,
      properties: { summary: "A mage with a cursed mark." },
      createdAt: now,
      updatedAt: now,
    });
    book.store.createEdge({
      id: "edge-1",
      bookId: book.id,
      type: "contains",
      fromId: "characters",
      toId: "character/elara",
      properties: {},
      createdAt: now,
    });

    book.store.createNode({
      id: "character/mentor",
      bookId: book.id,
      type: "character",
      label: "Mentor",
      contentUri: null,
      properties: { summary: "An old swordsman." },
      createdAt: now,
      updatedAt: now,
    });
    book.store.createEdge({
      id: "edge-2",
      bookId: book.id,
      type: "contains",
      fromId: "characters",
      toId: "character/mentor",
      properties: {},
      createdAt: now,
    });

    const context = await buildRetrievalContext(book, {
      queryText: "cursed mage",
      nodeTypes: ["character"],
      topK: 1,
    });

    expect(context).toContain("Elara");
    expect(context).toContain("cursed mark");
    expect(context).not.toContain("Mentor");
  });
});

describe("Retrieval integration with compose/edit", () => {
  let projectRoot: string;
  let book: Book;
  let stub: LLMStub;
  let lastPrompt: string;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Test Novel", genre: "xuanhuan" });
    stub = new LLMStub();
    stub.when(/.*/, "Stub response.");
    book.setLLMClient(async (options) => {
      const lastUser = [...options.messages].reverse().find((m) => m.role === "user");
      lastPrompt = lastUser?.content ?? "";
      return stub.call(options);
    });
    book.setEmbeddingProvider(createHashEmbeddingProvider(64));

    const now = new Date().toISOString();
    book.store.createNode({
      id: "character/elara",
      bookId: book.id,
      type: "character",
      label: "Elara",
      contentUri: null,
      properties: { summary: "A mage with a cursed mark." },
      createdAt: now,
      updatedAt: now,
    });
    book.store.createEdge({
      id: "edge-1",
      bookId: book.id,
      type: "contains",
      fromId: "characters",
      toId: "character/elara",
      properties: {},
      createdAt: now,
    });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("includes retrieval context in compose prompt", async () => {
    await book.compose({ intent: "introduce the cursed mage", targetWords: 100 });
    expect(lastPrompt).toContain("Relevant context from the story graph");
    expect(lastPrompt).toContain("Elara");
  });

  it("includes retrieval context in edit prompt", async () => {
    await book.compose({ intent: "introduce the cursed mage", targetWords: 100 });
    await book.edit({
      target: "chapter-0001/scene-1/paragraph-1",
      operation: "expand",
      instruction: "mention Elara and her cursed mark",
    });
    expect(lastPrompt).toContain("Relevant context from the story graph");
    expect(lastPrompt).toContain("Elara");
  });
});
