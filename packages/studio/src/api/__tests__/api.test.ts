import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createApiApp, BookManager } from "../index.js";
import { createLLMStub, LLMStub } from "@yanstory/core";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-studio-api-test-"));
}

describe("Studio API", () => {
  let projectRoot: string;
  let manager: BookManager;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    manager = new BookManager({ projectRoot, useStub: true });
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

  it("proposes and applies a patch from edited markdown", async () => {
    const app = createApp();
    const createRes = await app.request("/books", {
      method: "POST",
      body: JSON.stringify({ title: "Patch Test", genre: "xuanhuan" }),
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
    expect(chaptersRes.status).toBe(200);
    const { chapters } = await chaptersRes.json();
    expect(chapters.length).toBe(1);
    const chapterId = chapters[0].id;

    const projectionRes = await app.request(`/books/${id}/projection/${chapterId}`);
    expect(projectionRes.status).toBe(200);
    const { markdown } = await projectionRes.json();
    const editedMarkdown = `${markdown}\n\nAdditional paragraph for patch test.`;

    const proposeRes = await app.request(`/books/${id}/propose-patch`, {
      method: "POST",
      body: JSON.stringify({ chapterId, markdown: editedMarkdown }),
      headers: { "Content-Type": "application/json" },
    });
    expect(proposeRes.status).toBe(200);
    const { proposal } = await proposeRes.json();
    expect(proposal.operations.length).toBeGreaterThan(0);
    expect(proposal.operations.some((op: { op: string }) => op.op === "create")).toBe(true);

    const applyRes = await app.request(`/books/${id}/apply-patch`, {
      method: "POST",
      body: JSON.stringify({ proposal }),
      headers: { "Content-Type": "application/json" },
    });
    expect(applyRes.status).toBe(200);
    const { applied } = await applyRes.json();
    expect(applied).toBe(proposal.operations.length);
  });
});
