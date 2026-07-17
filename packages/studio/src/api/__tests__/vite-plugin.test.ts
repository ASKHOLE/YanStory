import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createServer } from "vite";
import { BookManager } from "../book-manager.js";
import { yanstoryApiPlugin } from "../vite-plugin.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-vite-plugin-test-"));
}

describe("yanstoryApiPlugin", () => {
  let projectRoot: string;
  let manager: BookManager;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    manager = new BookManager({ projectRoot, useStub: true });
    await manager.initialize();

    server = await createServer({
      configFile: false,
      plugins: [yanstoryApiPlugin({ manager })],
      server: { port: 0, host: true },
      optimizeDeps: { noDiscovery: true },
    });
    await server.listen();
  });

  afterEach(async () => {
    await server.close();
    manager.closeAll();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  function baseUrl(): string {
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Server address is not available");
    }
    return `http://localhost:${address.port}`;
  }

  it("proxies /api/health", async () => {
    const response = await fetch(`${baseUrl()}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("proxies POST /api/books and GET /api/books", async () => {
    const createResponse = await fetch(`${baseUrl()}/api/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Vite Test", genre: "xuanhuan" }),
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();
    expect(created.title).toBe("Vite Test");

    const listResponse = await fetch(`${baseUrl()}/api/books`);
    expect(listResponse.status).toBe(200);
    const { books } = await listResponse.json();
    expect(books.length).toBe(1);
    expect(books[0].title).toBe("Vite Test");
  });
});
