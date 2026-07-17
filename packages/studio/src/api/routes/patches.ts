import { Hono } from "hono";
import path from "node:path";
import fs from "node:fs/promises";
import type { BookManager } from "../book-manager.js";

export function createPatchesRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/chapters", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const chapters = book
      .findNodes("chapter")
      .sort((a, b) => Number(a.properties.chapterNumber ?? 0) - Number(b.properties.chapterNumber ?? 0));
    return c.json({
      chapters: chapters.map((node) => ({
        id: node.id,
        label: String(node.label ?? node.id),
        chapterNumber: Number(node.properties.chapterNumber ?? 0),
        contentUri: String(node.contentUri ?? ""),
      })),
    });
  });

  app.post("/:id/propose-patch", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const chapterId = String(body.chapterId ?? "");
    const markdown = String(body.markdown ?? "");

    if (!chapterId) {
      return c.json({ error: "chapterId is required" }, 400);
    }

    const book = await manager.getBook(bookId);
    const chapter = book.getNode(chapterId);
    if (!chapter || chapter.type !== "chapter") {
      return c.json({ error: "Chapter not found" }, 404);
    }
    if (!chapter.contentUri) {
      return c.json({ error: "Chapter has no editable content" }, 400);
    }

    const filePath = path.join(book.paths.root, chapter.contentUri);
    await fs.writeFile(filePath, markdown, "utf-8");

    const proposal = await book.proposePatch();
    return c.json({ proposal });
  });

  app.post("/:id/apply-patch", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const result = await book.applyPatch(body.proposal);
    return c.json({ applied: result.applied });
  });

  return app;
}
