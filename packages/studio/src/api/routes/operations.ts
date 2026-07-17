import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createOperationsRoutes(manager: BookManager) {
  const app = new Hono();

  app.post("/:id/compose", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);

    if (!book.llmClient) {
      return c.json({ error: "LLM client not configured" }, 400);
    }

    const result = await book.compose({
      intent: String(body.intent ?? ""),
      targetWords: body.targetWords ? Number(body.targetWords) : undefined,
      skipConstraints: Boolean(body.skipConstraints),
    });

    return c.json({
      nodeId: result.node.id,
      contentPath: result.contentPath,
      wordCount: result.wordCount,
    });
  });

  app.post("/:id/edit", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);

    if (!book.llmClient) {
      return c.json({ error: "LLM client not configured" }, 400);
    }

    const result = await book.edit({
      target: String(body.target),
      operation: String(body.operation),
      instruction: body.instruction ? String(body.instruction) : undefined,
      skipConstraints: Boolean(body.skipConstraints),
    });

    return c.json({
      nodeId: result.node.id,
      contentPath: result.contentPath,
    });
  });

  app.post("/:id/query", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const result = await book.query({
      type: String(body.type),
      filters: body.filters,
    });
    return c.json({ items: result.items });
  });

  app.get("/:id/projection", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const markdown = await book.projection();
    return c.json({ markdown });
  });

  app.get("/:id/projection/*", async (c) => {
    const bookId = c.req.param("id");
    const target = c.req.path.split("/projection/")[1] ?? "";
    const book = await manager.getBook(bookId);
    const markdown = await book.projection(target || undefined);
    return c.json({ markdown, target });
  });

  return app;
}
