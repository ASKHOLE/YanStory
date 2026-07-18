import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, LLMStub, createHashEmbeddingProvider } from "../../index.js";
import { critique } from "../critique.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-critique-test-"));
}

function createCritiqueStub(): (options: { messages: Array<{ role: string; content: string }> }) => Promise<{ content: string }> {
  const stub = new LLMStub();
  stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
    summary: "Solid pacing, weak dialogue.",
    verdict: "revise",
    scores: { pacing: 8, character: 7, worldbuilding: 6, dialogue: 4, originality: 7 },
    strengths: ["Fast opening"],
    weaknesses: ["Dialogue feels generic"],
    suggestions: ["Give the mentor a distinct voice"],
    genreNotes: ["Xuanhuan readers expect clear power progression hints"],
  }));
  return (options) => stub.call(options);
}

describe("critique", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Critique Test", genre: "xuanhuan" });
    book.setLLMClient(createCritiqueStub());
    book.setEmbeddingProvider(createHashEmbeddingProvider());
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("returns structured critique", async () => {
    await book.compose({ intent: "introduce hero", targetWords: 100 });
    const result = await critique(book, { target: "chapter-0001", role: "editor" });
    expect(result.summary).toBeTruthy();
    expect(result.scores.pacing).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
