import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { BookManager } from "./src/api/book-manager.js";
import { yanstoryApiPlugin } from "./src/api/vite-plugin.js";

const projectRoot = process.env.YANSTORY_PROJECT_ROOT ?? process.cwd();

export default defineConfig(async () => {
  const manager = new BookManager({
    projectRoot,
    useStub: process.env.YANSTORY_STUB === "true",
  });
  await manager.initialize();

  return {
    plugins: [react(), yanstoryApiPlugin({ manager })],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      port: 4567,
      host: true,
    },
    optimizeDeps: {
      exclude: ["@yanstory/core"],
    },
    build: {
      // Ensure server-only files are not bundled into the browser build.
      rollupOptions: {
        external: ["@yanstory/core"],
      },
    },
  };
});
