import type { IncomingMessage } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import type { BookManager } from "./book-manager.js";
import { createApiApp } from "./index.js";

export interface YanStoryApiPluginOptions {
  manager: BookManager;
  apiPrefix?: string;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function yanstoryApiPlugin(options: YanStoryApiPluginOptions): Plugin {
  const prefix = options.apiPrefix ?? "/api";
  return {
    name: "yanstory-api",
    configureServer(server: ViteDevServer) {
      const apiApp = createApiApp(options.manager);
      server.middlewares.use(prefix, async (req, res, next) => {
        try {
          const url = req.url ?? "/";
          const body = req.method !== "GET" && req.method !== "HEAD" ? await readBody(req) : undefined;

          const response = await apiApp.fetch(
            new Request(`http://${req.headers.host}${url}`, {
              method: req.method,
              headers: new Headers(
                Object.entries(req.headers).map(([k, v]) => [k, String(v ?? "")])
              ),
              body: body ? new Uint8Array(body) : undefined,
            })
          );

          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          const responseBody = await response.arrayBuffer();
          res.end(Buffer.from(responseBody));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
