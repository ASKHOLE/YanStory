import { Hono } from "hono";
import { buildConstraintTimeline } from "@yanstory/core";
import type { BookManager } from "../book-manager.js";

export function createConstraintsRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/constraints", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const constraints = book.listConstraints();
    return c.json({
      constraints: constraints.map((node) => ({
        id: node.id,
        dsl: String(node.properties.dsl ?? ""),
      })),
    });
  });

  app.get("/:id/constraints/timeline", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const timeline = buildConstraintTimeline(book);
    return c.json({ timeline });
  });

  app.post("/:id/constraints", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const constraint = book.addConstraint(String(body.dsl));
    return c.json({ id: constraint.id, dsl: String(constraint.properties.dsl ?? "") });
  });

  app.delete("/:id/constraints/:constraintId", async (c) => {
    const bookId = c.req.param("id");
    const constraintId = c.req.param("constraintId");
    const book = await manager.getBook(bookId);
    book.removeConstraint(constraintId);
    return c.json({ ok: true });
  });

  return app;
}
