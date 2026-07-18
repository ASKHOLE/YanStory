import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createBranchesRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/branches", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const branches = book.listBranches();
    return c.json({ branches });
  });

  app.post("/:id/branches", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const branch = await book.forkBranch(String(body.name ?? "branch"));
    return c.json(branch);
  });

  app.post("/:id/branches/:branchId/checkout", async (c) => {
    const bookId = c.req.param("id");
    const branchId = c.req.param("branchId");
    const branch = await manager.checkoutBranch(bookId, branchId);
    return c.json({ branch });
  });

  app.post("/:id/branches/:branchId/merge", async (c) => {
    const bookId = c.req.param("id");
    const sourceBranchId = c.req.param("branchId");
    const book = await manager.getBook(bookId);
    const proposal = await book.mergeBranches(sourceBranchId);
    return c.json({ proposal });
  });

  return app;
}
