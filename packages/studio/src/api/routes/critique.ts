import { Hono } from "hono";
import { critique } from "@yanstory/core";
import type { BookManager } from "../book-manager.js";

export function createCritiqueRoutes(manager: BookManager) {
  const app = new Hono();

  app.post("/:id/critique", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const result = await critique(book, {
      target: body.target,
      role: body.role,
      focus: body.focus,
    });
    return c.json(result);
  });

  return app;
}
