import { Hono } from "hono";
import { addClue, buildClueTimeline, resolveClue } from "@yanstory/core";
import type { BookManager } from "../book-manager.js";

export function createCluesRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/clues", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const clues = await buildClueTimeline(book);
    return c.json({ clues });
  });

  app.post("/:id/clues", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);

    try {
      const clue = await addClue(book, {
        label: String(body.label ?? ""),
        description: body.description ? String(body.description) : undefined,
        plantAt: String(body.plantAt ?? ""),
        resolveAt: body.resolveAt ? String(body.resolveAt) : undefined,
        targetId: body.targetId ? String(body.targetId) : undefined,
        order: body.order ? Number(body.order) : undefined,
      });
      return c.json({ clue });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  app.post("/:id/clues/:clueId/resolve", async (c) => {
    const bookId = c.req.param("id");
    const clueId = c.req.param("clueId");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);

    try {
      const clue = await resolveClue(book, {
        clueId,
        resolveAt: String(body.resolveAt ?? ""),
      });
      return c.json({ clue });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  return app;
}
