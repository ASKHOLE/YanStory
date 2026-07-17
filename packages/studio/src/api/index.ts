import { Hono } from "hono";
import type { BookManager } from "./book-manager.js";
import { apiErrorHandler } from "./middleware/error.js";
import { createBooksRoutes } from "./routes/books.js";
import { createOperationsRoutes } from "./routes/operations.js";
import { createConstraintsRoutes } from "./routes/constraints.js";
import { createSnapshotsRoutes } from "./routes/snapshots.js";
import { createPatchesRoutes } from "./routes/patches.js";

export function createApiApp(manager: BookManager): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.onError(apiErrorHandler);

  app.route("/books", createBooksRoutes(manager));
  app.route("/books", createOperationsRoutes(manager));
  app.route("/books", createConstraintsRoutes(manager));
  app.route("/books", createSnapshotsRoutes(manager));
  app.route("/books", createPatchesRoutes(manager));

  return app;
}

export { BookManager } from "./book-manager.js";
