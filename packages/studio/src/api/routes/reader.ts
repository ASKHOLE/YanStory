import { Hono } from "hono";
import { simulateReader } from "@yanstory/core";
import type { BookManager } from "../book-manager.js";

export function createReaderRoutes(manager: BookManager) {
  const app = new Hono();

  app.post("/:id/simulate-reader", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const result = await simulateReader(book, {
      target: body.target,
      perspective: body.perspective,
      focus: body.focus,
    });
    return c.json(result);
  });

  return app;
}
