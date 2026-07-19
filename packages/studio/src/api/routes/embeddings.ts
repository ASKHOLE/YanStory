import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createEmbeddingsRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/embedding-config", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const config = manager.getEmbeddingConfig();
    return c.json({ config });
  });

  app.post("/:id/reindex-embeddings", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const nodeTypes = Array.isArray(body.nodeTypes) ? body.nodeTypes.map(String) : undefined;
    const book = await manager.getBook(bookId);
    await book.ensureEmbeddings(nodeTypes);
    return c.json({ ok: true });
  });

  return app;
}
