import path from "node:path";
import fs from "node:fs/promises";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { BookManager } from "./api/book-manager.js";
import { createApiApp } from "./api/index.js";

async function main() {
  const projectRoot = process.env.YANSTORY_PROJECT_ROOT ?? process.cwd();
  const port = Number(process.env.YANSTORY_PORT ?? 4567);
  const useStub = process.env.YANSTORY_STUB === "true";

  const manager = new BookManager({ projectRoot, useStub });
  await manager.initialize();

  const apiApp = createApiApp(manager);
  const app = new Hono();

  app.route("/api", apiApp);

  const distDir = path.resolve(process.cwd(), "dist");
  try {
    const stat = await fs.stat(distDir);
    if (stat.isDirectory()) {
      app.use("/*", serveStatic({ root: distDir }));
      app.get("/*", serveStatic({ path: path.join(distDir, "index.html") }));
    }
  } catch {
    // dist not found; API-only mode.
  }

  process.on("SIGINT", () => {
    manager.closeAll();
    process.exit(0);
  });

  serve({ fetch: app.fetch, port }, () => {
    console.log(`YanStory Studio server running at http://localhost:${port}`);
    console.log(`Project root: ${projectRoot}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
