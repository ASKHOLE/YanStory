import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createSnapshotsRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/snapshots", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const snapshots = book.store.listSnapshots(bookId);
    return c.json({ snapshots });
  });

  app.post("/:id/snapshots", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const id = await book.snapshot(String(body.name ?? `manual-${Date.now()}`));
    return c.json({ id });
  });

  app.post("/:id/snapshots/:snapshotId/restore", async (c) => {
    const bookId = c.req.param("id");
    const snapshotId = c.req.param("snapshotId");
    const book = await manager.getBook(bookId);
    await book.restoreSnapshot(snapshotId);
    // Book instance is closed after restore; reopen to continue serving.
    manager.closeBook(bookId);
    await manager.openBook(bookId);
    return c.json({ ok: true });
  });

  return app;
}
