import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, LLMStub, createHashEmbeddingProvider } from "../../index.js";
import { PromptCache } from "../prompt-cache.js";
import { simulateReader } from "../reader.js";
import * as retrieval from "../retrieval.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-prompt-cache-test-"));
}

function createLLMStub(): (options: { messages: Array<{ role: string; content: string }> }) => Promise<{ content: string }> {
  const stub = new LLMStub();
  stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
    summary: "Clear and engaging.",
    scores: { comprehension: 8, engagement: 8, consistency: 8, suspense: 8 },
    highlights: [],
    questions: [],
    predictions: [],
  }));
  return (options) => stub.call(options);
}

describe("PromptCache", () => {
  it("caches builder result for identical key and version", async () => {
    const cache = new PromptCache();
    const builder = vi.fn().mockResolvedValue("prompt v1");

    const first = await cache.compile({ operation: "compose", options: { intent: "test" } }, "v1", builder);
    const second = await cache.compile({ operation: "compose", options: { intent: "test" } }, "v1", builder);

    expect(first).toBe("prompt v1");
    expect(second).toBe("prompt v1");
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it("rebuilds when version changes", async () => {
    const cache = new PromptCache();
    const builder = vi.fn().mockResolvedValueOnce("prompt v1").mockResolvedValueOnce("prompt v2");

    const first = await cache.compile({ operation: "compose", options: { intent: "test" } }, "v1", builder);
    const second = await cache.compile({ operation: "compose", options: { intent: "test" } }, "v2", builder);

    expect(first).toBe("prompt v1");
    expect(second).toBe("prompt v2");
    expect(builder).toHaveBeenCalledTimes(2);
  });

  it("clears all entries", async () => {
    const cache = new PromptCache();
    const builder = vi.fn().mockResolvedValue("prompt");

    await cache.compile({ operation: "compose", options: { intent: "a" } }, "v1", builder);
    cache.clear();
    await cache.compile({ operation: "compose", options: { intent: "a" } }, "v1", builder);

    expect(builder).toHaveBeenCalledTimes(2);
  });
});

describe("Book.compilePrompt", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Cache Test", genre: "xuanhuan" });
    book.setLLMClient(createLLMStub());
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("caches the prompt when state has not changed", async () => {
    const builder = vi.fn().mockResolvedValue("cached prompt");

    const first = await book.compilePrompt("test", { key: "value" }, builder);
    const second = await book.compilePrompt("test", { key: "value" }, builder);

    expect(first).toBe("cached prompt");
    expect(second).toBe("cached prompt");
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it("normalizes array order in options", async () => {
    const builder = vi.fn().mockResolvedValue("prompt");

    await book.compilePrompt("reader", { focus: ["a", "b", "c"] }, builder);
    await book.compilePrompt("reader", { focus: ["c", "a", "b"] }, builder);

    expect(builder).toHaveBeenCalledTimes(1);
  });

  it("rebuilds after a graph mutation", async () => {
    const builder = vi.fn().mockResolvedValue("prompt");

    await book.compilePrompt("test", { key: "value" }, builder);
    book.store.createNode({
      id: "note-1",
      bookId: book.id,
      type: "note",
      label: "Note",
      contentUri: null,
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await book.compilePrompt("test", { key: "value" }, builder);

    expect(builder).toHaveBeenCalledTimes(2);
  });

  it("rebuilds after embedding provider changes", async () => {
    const builder = vi.fn().mockResolvedValue("prompt");

    await book.compilePrompt("test", { key: "value" }, builder);
    book.setEmbeddingProvider(createHashEmbeddingProvider(64));
    await book.compilePrompt("test", { key: "value" }, builder);

    expect(builder).toHaveBeenCalledTimes(2);
  });
});

describe("Prompt cache integration with operations", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Integration Test", genre: "xuanhuan" });
    book.setLLMClient(createLLMStub());
    book.setEmbeddingProvider(createHashEmbeddingProvider());
    await book.compose({ intent: "introduce hero", targetWords: 100 });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("avoids rebuilding retrieval context on repeated reader calls", async () => {
    const buildRetrievalContextSpy = vi.spyOn(retrieval, "buildRetrievalContext").mockResolvedValue("");

    await simulateReader(book, { target: "chapter-0001" });
    await simulateReader(book, { target: "chapter-0001" });

    expect(buildRetrievalContextSpy).toHaveBeenCalledTimes(1);
    buildRetrievalContextSpy.mockRestore();
  });

  it("rebuilds prompt after edit invalidates cache", async () => {
    const buildRetrievalContextSpy = vi.spyOn(retrieval, "buildRetrievalContext").mockResolvedValue("");

    await simulateReader(book, { target: "chapter-0001" });
    await book.edit({ target: "chapter-0001/scene-1/paragraph-1", operation: "shorten" });
    await simulateReader(book, { target: "chapter-0001" });

    // 1 reader build + 1 edit build + 1 reader build after state change
    expect(buildRetrievalContextSpy).toHaveBeenCalledTimes(3);
    buildRetrievalContextSpy.mockRestore();
  });
});
