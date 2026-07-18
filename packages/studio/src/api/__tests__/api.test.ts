import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createApiApp, BookManager } from "../index.js";
import { createLLMStub, LLMStub, createHashEmbeddingProvider } from "@yanstory/core";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-studio-api-test-"));
}

describe("Studio API", () => {
  let projectRoot: string;
  let manager: BookManager;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    manager = new BookManager({
      projectRoot,
      useStub: true,
      embeddingProvider: createHashEmbeddingProvider(),
    });
    await manager.initialize();
  });

  afterEach(async () => {
    manager.closeAll();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  function createApp() {
    return createApiApp(manager);
  }

  it("returns health check", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("creates and lists books", async () => {
    const app = createApp();

    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "API Novel", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.title).toBe("API Novel");

    const listRes = await app.request("/books");
    expect(listRes.status).toBe(200);
    const { books } = await listRes.json();
    expect(books.length).toBe(1);
    expect(books[0].title).toBe("API Novel");
  });

  it("composes a chapter", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Compose Test", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    const { id } = await createRes.json();

    const book = await manager.getBook(id);
    const stub = createLLMStub();
    book.setLLMClient(stub);

    const composeRes = await app.request(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(composeRes.status).toBe(200);
    const result = await composeRes.json();
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.nodeId).toMatch(/chapter-0001/);
  });

  it("returns 409 on constraint violation", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Constraint Test", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    const { id } = await createRes.json();

    const book = await manager.getBook(id);
    const stub = new LLMStub();
    stub.when(/.*魔法.*/, "主角施展了魔法。");
    book.setLLMClient((options) => stub.call(options));
    book.addConstraint("forbid 魔法 until chapter-0004");

    const composeRes = await app.request(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent: "主角使用魔法", targetWords: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    const text = await composeRes.text();
    console.log("composeRes status", composeRes.status, text);
    expect(composeRes.status).toBe(409);
    const data = JSON.parse(text);
    expect(data.error).toBe("ConstraintError");
  });

  it("searches similar paragraphs", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Search Test", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    const { id } = await createRes.json();

    const book = await manager.getBook(id);
    book.setLLMClient(createLLMStub());

    const composeRes = await app.request(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(composeRes.status).toBe(200);

    const searchRes = await app.request(`/books/${id}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "hero protagonist", nodeTypes: ["paragraph"], topK: 5 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(searchRes.status).toBe(200);
    const { results } = await searchRes.json();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("nodeId");
    expect(results[0]).toHaveProperty("score");
  });

  it("simulates a reader", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Reader API Test", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    const { id } = await createRes.json();

    const book = await manager.getBook(id);
    const stub = new LLMStub();
    stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
      summary: "Clear and engaging.",
      scores: { comprehension: 8, engagement: 9, consistency: 7, suspense: 6 },
      highlights: [{ type: "engaging", reason: "Strong opening" }],
      questions: ["What happens next?"],
      predictions: ["The hero will train."],
    }));
    book.setLLMClient((options) => stub.call(options));

    await app.request(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
      headers: { "Content-Type": "application/json" },
    });

    const readerRes = await app.request(`/books/${id}/simulate-reader`, {
      method: "POST",
      body: JSON.stringify({ target: "chapter-0001" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(readerRes.status).toBe(200);
    const result = await readerRes.json();
    expect(result.summary).toBe("Clear and engaging.");
    expect(result.scores.engagement).toBe(9);
    expect(result.highlights.length).toBeGreaterThan(0);
  });

  it("lists characters, events, and relationships", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Relationship Test", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    const { id } = await createRes.json();

    const book = await manager.getBook(id);
    book.setLLMClient(createLLMStub());

    const composeRes = await app.request(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(composeRes.status).toBe(200);

    const chaptersRes = await app.request(`/books/${id}/chapters`);
    const { chapters } = await chaptersRes.json();
    const chapterId = chapters[0].id;
    const sceneId = `${chapterId}/scene-1`;

    const now = new Date().toISOString();
    book.store.createNode({
      id: "character-hero",
      bookId: id,
      type: "character",
      label: "Hero",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    book.store.createNode({
      id: "character-mentor",
      bookId: id,
      type: "character",
      label: "Mentor",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    book.store.createNode({
      id: "event-awakening",
      bookId: id,
      type: "event",
      label: "Awakening",
      contentUri: null,
      properties: { when: "Chapter 1", order: 1 },
      createdAt: now,
      updatedAt: now,
    });

    book.store.createEdge({
      id: "edge-1",
      bookId: id,
      type: "appears_in",
      fromId: "character-hero",
      toId: sceneId,
      properties: {},
      createdAt: now,
    });
    book.store.createEdge({
      id: "edge-2",
      bookId: id,
      type: "appears_in",
      fromId: "character-mentor",
      toId: sceneId,
      properties: {},
      createdAt: now,
    });

    const charactersRes = await app.request(`/books/${id}/characters`);
    expect(charactersRes.status).toBe(200);
    const { characters } = await charactersRes.json();
    expect(characters.length).toBe(2);
    expect(characters.some((c: { id: string }) => c.id === "character-hero")).toBe(true);

    const eventsRes = await app.request(`/books/${id}/events`);
    expect(eventsRes.status).toBe(200);
    const { events } = await eventsRes.json();
    expect(events.length).toBe(1);
    expect(events[0].label).toBe("Awakening");

    const relationshipsRes = await app.request(`/books/${id}/relationships`);
    expect(relationshipsRes.status).toBe(200);
    const { nodes, links } = await relationshipsRes.json();
    expect(nodes.length).toBe(2);
    expect(links.length).toBe(1);
    expect(links[0].strength).toBe(1);
  });

  it("runs a genre critique", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Critique API Test", genre: "xuanhuan" }),
      headers: { "Content-Type": "application/json" },
    });
    const { id } = await createRes.json();

    const book = await manager.getBook(id);
    const stub = new LLMStub();
    stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
      summary: "Good start.",
      verdict: "revise",
      scores: { pacing: 7, character: 8, worldbuilding: 6, dialogue: 7, originality: 7 },
      strengths: ["Clear setup"],
      weaknesses: ["Slow middle"],
      suggestions: ["Add tension"],
      genreNotes: ["Power system hint expected"],
    }));
    book.setLLMClient((options) => stub.call(options));

    await app.request(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
      headers: { "Content-Type": "application/json" },
    });

    const critiqueRes = await app.request(`/books/${id}/critique`, {
      method: "POST",
      body: JSON.stringify({ target: "chapter-0001", role: "editor" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(critiqueRes.status).toBe(200);
    const result = await critiqueRes.json();
    expect(result.summary).toBe("Good start.");
    expect(result.scores.character).toBe(8);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
