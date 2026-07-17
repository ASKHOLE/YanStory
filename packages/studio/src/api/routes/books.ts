import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createBooksRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/", async (c) => {
    const books = await manager.listBooks();
    return c.json({ books });
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    const title = String(body.title ?? "Untitled");
    const genre = String(body.genre ?? "general");
    const book = await manager.createBook(title, genre);
    const meta = book.getNode("book");
    return c.json({
      id: book.id,
      title: meta?.label ?? title,
      genre: String(meta?.properties.genre ?? genre),
      createdAt: new Date().toISOString(),
    });
  });

  app.post("/:id/open", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.openBook(bookId);
    const meta = book.getNode("book");
    return c.json({
      id: book.id,
      title: meta?.label ?? "Untitled",
      genre: String(meta?.properties.genre ?? "general"),
    });
  });

  app.get("/:id/info", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const meta = book.getNode("book");
    const chapters = book.findNodes("chapter");
    const scenes = book.findNodes("scene");
    const paragraphs = book.findNodes("paragraph");
    const snapshots = book.store.listSnapshots(book.id);
    const constraints = book.listConstraints();
    return c.json({
      id: book.id,
      title: meta?.label ?? "Untitled",
      genre: String(meta?.properties.genre ?? "general"),
      author: String(meta?.properties.author ?? ""),
      chapters: chapters.length,
      scenes: scenes.length,
      paragraphs: paragraphs.length,
      snapshots: snapshots.length,
      constraints: constraints.length,
    });
  });

  return app;
}
