import { Hono } from "hono";
import { helloCore } from "@yanstory/core";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ ok: true, message: helloCore() });
});

export default app;
