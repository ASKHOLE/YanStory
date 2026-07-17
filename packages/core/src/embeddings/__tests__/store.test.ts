import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { GraphStore } from "../../graph/store.js";
import { EmbeddingStore } from "../store.js";
import { createHashEmbeddingProvider } from "../stub.js";

async function createTempDbPath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "yanstory-embed-test-"));
  return path.join(dir, "graph.db");
}

describe("EmbeddingStore", () => {
  let dbPath: string;
  let store: GraphStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(async () => {
    dbPath = await createTempDbPath();
    store = new GraphStore(dbPath);
    embeddingStore = new EmbeddingStore(store, createHashEmbeddingProvider(32));

    const now = new Date().toISOString();
    store.createNode({
      id: "node-1",
      bookId: "book-1",
      type: "note",
      label: "Node 1",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    store.createNode({
      id: "node-a",
      bookId: "book-1",
      type: "note",
      label: "Node A",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    store.createNode({
      id: "node-b",
      bookId: "book-1",
      type: "note",
      label: "Node B",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    store.createNode({
      id: "node-c",
      bookId: "book-1",
      type: "note",
      label: "Node C",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    store.close();
  });

  it("upserts and retrieves embeddings", async () => {
    await embeddingStore.upsert({
      id: "embed-1",
      bookId: "book-1",
      nodeId: "node-1",
      model: "hash",
      vector: await embeddingStore.embed(["hello world"]).then((v) => v[0]),
      createdAt: new Date().toISOString(),
    });

    const record = embeddingStore.get("book-1", "node-1");
    expect(record).toBeDefined();
    expect(record?.nodeId).toBe("node-1");
    expect(record?.vector.length).toBe(32);
  });

  it("finds similar embeddings", async () => {
    const [v1, v2, v3] = await embeddingStore.embed([
      "the quick brown fox",
      "the fast brown fox",
      "completely unrelated quantum physics",
    ]);

    await embeddingStore.upsert({
      id: "a",
      bookId: "book-1",
      nodeId: "node-a",
      model: "hash",
      vector: v1,
      createdAt: new Date().toISOString(),
    });
    await embeddingStore.upsert({
      id: "b",
      bookId: "book-1",
      nodeId: "node-b",
      model: "hash",
      vector: v2,
      createdAt: new Date().toISOString(),
    });
    await embeddingStore.upsert({
      id: "c",
      bookId: "book-1",
      nodeId: "node-c",
      model: "hash",
      vector: v3,
      createdAt: new Date().toISOString(),
    });

    const [query] = await embeddingStore.embed(["the quick brown fox"]);
    const results = await embeddingStore.findSimilar("book-1", query, { topK: 2 });

    expect(results.length).toBe(2);
    expect(results[0].nodeId).toBe("node-a");
    expect(results[1].nodeId).toBe("node-b");
  });
});
