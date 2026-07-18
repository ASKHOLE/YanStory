import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, createLLMStub, LLMStub, createHashEmbeddingProvider } from "../../index.js";
import { simulateReader } from "../reader.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-reader-test-"));
}

function createReaderStub(): ReturnType<typeof createLLMStub> {
  const stub = new LLMStub();
  stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
    summary: "The hero introduction is clear and engaging.",
    scores: { comprehension: 8, engagement: 9, consistency: 7, suspense: 6 },
    highlights: [
      { type: "engaging", quote: "The hero stood alone.", reason: "Strong visual opening." },
      { type: "memorable", reason: "The cursed academy premise is intriguing." },
    ],
    questions: ["What is the hero's name?"],
    predictions: ["The hero will enter the academy."],
  }));
  return (options) => stub.call(options);
}

describe("simulateReader", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Reader Test", genre: "xuanhuan" });
    book.setLLMClient(createReaderStub());
    book.setEmbeddingProvider(createHashEmbeddingProvider());
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("returns structured reader feedback for a chapter", async () => {
    await book.compose({ intent: "introduce hero", targetWords: 100 });
    const result = await simulateReader(book, { target: "chapter-0001" });
    expect(result.summary).toBe("The hero introduction is clear and engaging.");
    expect(result.scores.comprehension).toBe(8);
    expect(result.scores.engagement).toBe(9);
    expect(result.highlights.length).toBe(2);
    expect(result.questions.length).toBe(1);
    expect(result.predictions.length).toBe(1);
  });

  it("throws when LLM client is not configured", async () => {
    const freshBook = await Book.create({ projectRoot, title: "No LLM", genre: "xuanhuan" });
    freshBook.setEmbeddingProvider(createHashEmbeddingProvider());
    await expect(simulateReader(freshBook, {})).rejects.toThrow("LLM client not configured");
    freshBook.close();
  });
});
