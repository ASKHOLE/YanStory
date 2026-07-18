# 读者模拟器代理实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 YanStory 能以“读者”身份阅读章节并返回结构化反馈（理解度、情绪、悬念、一致性、疑问），帮助作者发现叙事盲点。

**Architecture:** 复用现有 LLM client 与检索上下文，新增 `simulateReader` 操作。操作会读取目标章节/场景的 Markdown 投影，结合相关人物/事件/设定上下文，构造读者视角的 prompt，解析 LLM 返回为结构化反馈。Studio 侧新增 API 路由与 Reader 面板展示结果。

**Tech Stack:** TypeScript, Vitest, Hono, React

---

## File Mapping

| 文件 | 职责 |
|---|---|
| `packages/core/src/operations/types.ts` | 新增 `SimulateReaderOptions`、`SimulateReaderResult`、`ReaderFeedback` 类型 |
| `packages/core/src/operations/reader.ts` | 实现 `simulateReader` 操作与 prompt |
| `packages/core/src/index.ts` | 导出 `simulateReader` 和类型 |
| `packages/core/src/operations/__tests__/reader.test.ts` | 测试 reader 操作 |
| `packages/studio/src/api/routes/reader.ts` | Hono 路由 `POST /books/:id/simulate-reader` |
| `packages/studio/src/api/index.ts` | 挂载 reader 路由 |
| `packages/studio/src/api/client.ts` | 前端 API 方法 `simulateReader` |
| `packages/studio/src/components/ReaderPanel.tsx` | Reader 模拟器 UI |
| `packages/studio/src/components/BookWorkspace.tsx` | 新增 "reader" 标签 |
| `packages/studio/src/components/__tests__/ReaderPanel.test.tsx` | 组件测试 |
| `packages/studio/src/api/__tests__/api.test.ts` | API 集成测试 |

---

### Task 1: 定义读者模拟器类型

**Files:**
- Modify: `packages/core/src/operations/types.ts`

- [ ] **Step 1: 添加类型**

```ts
export interface SimulateReaderOptions {
  target?: string;
  perspective?: string;
  focus?: string[];
}

export interface ReaderHighlight {
  type: "confusing" | "engaging" | "boring" | "inconsistent" | "memorable";
  quote?: string;
  reason: string;
}

export interface ReaderScores {
  comprehension: number;
  engagement: number;
  consistency: number;
  suspense: number;
}

export interface SimulateReaderResult {
  summary: string;
  scores: ReaderScores;
  highlights: ReaderHighlight[];
  questions: string[];
  predictions: string[];
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/core/src/operations/types.ts
git commit -m "feat: add reader simulator operation types"
```

---

### Task 2: 实现 `simulateReader` 操作

**Files:**
- Create: `packages/core/src/operations/reader.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/operations/__tests__/reader.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, createLLMStub, createHashEmbeddingProvider } from "../../index.js";
import { simulateReader } from "../reader.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-reader-test-"));
}

describe("simulateReader", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Reader Test", genre: "xuanhuan" });
    book.setLLMClient(createLLMStub());
    book.setEmbeddingProvider(createHashEmbeddingProvider());
  });

  afterEach(() => {
    book.close();
  });

  it("returns structured reader feedback for a chapter", async () => {
    await book.compose({ intent: "introduce hero", targetWords: 100 });
    const result = await simulateReader(book, { target: "chapter-0001" });
    expect(result.summary).toBeTruthy();
    expect(result.scores.comprehension).toBeGreaterThan(0);
    expect(result.highlights.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @yanstory/core test -- src/operations/__tests__/reader.test.ts`
Expected: FAIL - `reader.js` not found

- [ ] **Step 3: 实现操作**

创建 `packages/core/src/operations/reader.ts`：

```ts
import type { Book } from "../models/book.js";
import { buildRetrievalContext } from "./retrieval.js";
import type { SimulateReaderOptions, SimulateReaderResult } from "./types.js";

function parseReaderJson(content: string): SimulateReaderResult {
  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: String(parsed.summary ?? ""),
    scores: {
      comprehension: Number(parsed.scores?.comprehension ?? 0),
      engagement: Number(parsed.scores?.engagement ?? 0),
      consistency: Number(parsed.scores?.consistency ?? 0),
      suspense: Number(parsed.scores?.suspense ?? 0),
    },
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
  };
}

export async function simulateReader(
  book: Book,
  options: SimulateReaderOptions = {}
): Promise<SimulateReaderResult> {
  if (!book.llmClient) {
    throw new Error("LLM client not configured. Call book.setLLMClient(...) before simulating reader.");
  }

  const target = options.target ?? "book";
  const projection = book.projection(target);
  const retrievalContext = await buildRetrievalContext(book, {
    queryText: projection.markdown,
    nodeTypes: ["character", "location", "event"],
    topK: 5,
  });

  const perspective = options.perspective ?? "a first-time reader of this genre";
  const focus = options.focus ?? ["comprehension", "engagement", "consistency", "suspense"];

  const prompt = [
    "You are simulating a reader who has just read the following chapter/scene of a novel.",
    `Reader perspective: ${perspective}`,
    `Focus areas: ${focus.join(", ")}`,
    retrievalContext ? `Relevant context from earlier in the story:\n${retrievalContext}` : "",
    "Text to evaluate:",
    "---",
    projection.markdown,
    "---",
    "Respond ONLY with valid JSON in this exact structure:",
    JSON.stringify({
      summary: "short overall reaction",
      scores: { comprehension: 0, engagement: 0, consistency: 0, suspense: 0 },
      highlights: [{ type: "engaging", quote: "optional quoted text", reason: "why" }],
      questions: ["question 1"],
      predictions: ["prediction 1"],
    }),
    "Scores should be integers 1-10. Highlight type must be one of: confusing, engaging, boring, inconsistent, memorable.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await book.llmClient({ messages: [{ role: "user", content: prompt }] });
  return parseReaderJson(response.content);
}
```

- [ ] **Step 4: 导出操作**

在 `packages/core/src/index.ts` 中：

```ts
export { simulateReader } from "./operations/reader.js";
export type {
  SimulateReaderOptions,
  SimulateReaderResult,
  ReaderScores,
  ReaderHighlight,
} from "./operations/types.js";
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @yanstory/core test -- src/operations/__tests__/reader.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/operations/reader.ts packages/core/src/operations/__tests__/reader.test.ts packages/core/src/index.ts packages/core/src/operations/types.ts
git commit -m "feat: implement simulateReader operation"
```

---

### Task 3: 添加 Studio API 路由

**Files:**
- Create: `packages/studio/src/api/routes/reader.ts`
- Modify: `packages/studio/src/api/index.ts`
- Modify: `packages/studio/src/api/client.ts`

- [ ] **Step 1: 创建路由**

创建 `packages/studio/src/api/routes/reader.ts`：

```ts
import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createReaderRoutes(manager: BookManager) {
  const app = new Hono();

  app.post("/:id/simulate-reader", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const result = await simulateReader(book, {
      target: body.target,
      perspective: body.perspective,
      focus: body.focus,
    });
    return c.json(result);
  });

  return app;
}
```

- [ ] **Step 2: 挂载路由**

在 `packages/studio/src/api/index.ts` 中导入并挂载：

```ts
import { createReaderRoutes } from "./routes/reader.js";
app.route("/books", createReaderRoutes(manager));
```

- [ ] **Step 3: 扩展 client**

在 `packages/studio/src/api/client.ts` 中：

```ts
import type { SimulateReaderOptions, SimulateReaderResult } from "@yanstory/core";

simulateReader: (id: string, options?: SimulateReaderOptions) =>
  fetchJson<SimulateReaderResult>(`/books/${id}/simulate-reader`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  }),
```

- [ ] **Step 4: 提交**

```bash
git add packages/studio/src/api/routes/reader.ts packages/studio/src/api/index.ts packages/studio/src/api/client.ts
git commit -m "feat: add reader simulator API route and client"
```

---

### Task 4: 实现 ReaderPanel 前端组件

**Files:**
- Create: `packages/studio/src/components/ReaderPanel.tsx`
- Modify: `packages/studio/src/components/BookWorkspace.tsx`
- Test: `packages/studio/src/components/__tests__/ReaderPanel.test.tsx`

- [ ] **Step 1: 创建组件**

创建 `packages/studio/src/components/ReaderPanel.tsx`：

```tsx
import { useState } from "react";
import type { BookInfo, SimulateReaderResult } from "../api/client.js";
import { api } from "../api/client.js";

interface ReaderPanelProps {
  book: BookInfo;
}

export function ReaderPanel({ book }: ReaderPanelProps) {
  const [target, setTarget] = useState("");
  const [perspective, setPerspective] = useState("first-time reader");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateReaderResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.simulateReader(book.id, {
        target: target || undefined,
        perspective,
        focus: ["comprehension", "engagement", "consistency", "suspense"],
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <div style={{ padding: 12, background: "#fee2e2", borderRadius: 4, marginBottom: 16 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target path (optional, default: whole book)"
            style={{ flex: 1 }}
          />
          <select value={perspective} onChange={(e) => setPerspective(e.target.value)} style={{ width: 180 }}>
            <option value="first-time reader">First-time reader</option>
            <option value="genre fan">Genre fan</option>
            <option value="critical reader">Critical reader</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>{loading ? "Simulating..." : "Simulate Reader"}</button>
      </form>

      {result && (
        <div>
          <div style={{ padding: 12, background: "#f3f4f6", borderRadius: 4, marginBottom: 16 }}>
            <strong>Summary</strong>
            <p style={{ margin: "8px 0 0" }}>{result.summary}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {Object.entries(result.scores).map(([key, value]) => (
              <div key={key} style={{ padding: 12, background: "#f9fafb", borderRadius: 4, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{key}</div>
                <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
              </div>
            ))}
          </div>

          <h4 style={{ marginBottom: 8 }}>Highlights</h4>
          <ul style={{ listStyle: "none", padding: 0, marginBottom: 16 }}>
            {result.highlights.map((highlight, index) => (
              <li
                key={index}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 4,
                  background:
                    highlight.type === "engaging"
                      ? "#dcfce7"
                      : highlight.type === "confusing" || highlight.type === "inconsistent"
                        ? "#fee2e2"
                        : "#fef9c3",
                }}
              >
                <strong style={{ textTransform: "uppercase", fontSize: 12 }}>{highlight.type}</strong>
                {highlight.quote && <blockquote style={{ margin: "8px 0", fontStyle: "italic" }}>{highlight.quote}</blockquote>}
                <p style={{ margin: 0 }}>{highlight.reason}</p>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Questions</h4>
              <ul>
                {result.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Predictions</h4>
              <ul>
                {result.predictions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 更新 BookWorkspace**

在 `BookWorkspace.tsx` 中：

```ts
import { ReaderPanel } from "./ReaderPanel.js";
type Tab = "compose" | ... | "reader";
```

标签数组增加 `"reader"`，渲染区增加：

```tsx
{tab === "reader" && <ReaderPanel book={book} />}
```

- [ ] **Step 3: 组件测试**

创建 `packages/studio/src/components/__tests__/ReaderPanel.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReaderPanel } from "../ReaderPanel.js";

const sampleBook = {
  id: "book-1",
  title: "Reader Book",
  genre: "xuanhuan",
  author: "",
  chapters: 1,
  scenes: 0,
  paragraphs: 0,
  snapshots: 0,
  constraints: 0,
};

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ReaderPanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("simulates reader and displays scores", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        summary: "Engaging opening.",
        scores: { comprehension: 8, engagement: 9, consistency: 7, suspense: 8 },
        highlights: [{ type: "engaging", reason: "Strong hook" }],
        questions: ["Who is the mentor?"],
        predictions: ["The hero will leave the village."],
      })
    );

    render(<ReaderPanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate Reader" }));

    await waitFor(() => {
      expect(screen.getByText("Engaging opening.")).toBeInTheDocument();
    });
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Who is the mentor?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 提交**

```bash
git add packages/studio/src/components/ReaderPanel.tsx packages/studio/src/components/BookWorkspace.tsx packages/studio/src/components/__tests__/ReaderPanel.test.tsx
git commit -m "feat: add ReaderPanel component and workspace tab"
```

---

### Task 5: API 集成测试

**Files:**
- Modify: `packages/studio/src/api/__tests__/api.test.ts`

- [ ] **Step 1: 添加测试**

```ts
it("simulates a reader", async () => {
  const app = createApp();
  const createRes = await app.request("/books", {
    method: "POST",
    body: JSON.stringify({ title: "Reader API Test", genre: "xuanhuan" }),
    headers: { "Content-Type": "application/json" },
  });
  const { id } = await createRes.json();

  const book = await manager.getBook(id);
  book.setLLMClient(createLLMStub());

  await app.request(`/books/${id}/compose`, {
    method: "POST",
    body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
    headers: { "Content-Type": "application/json" },
  });

  const readerRes = await app.request(`/books/${id}/simulate-reader`, {
    method: "POST",
    body: JSON.stringify({ target: "chapter-0001" }),
    headers: { "Content-Type": "application/json" },
  });
  expect(readerRes.status).toBe(200);
  const result = await readerRes.json();
  expect(result.summary).toBeTruthy();
  expect(result.scores).toBeDefined();
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm --filter @yanstory/studio test -- src/api/__tests__/api.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/studio/src/api/__tests__/api.test.ts
git commit -m "test: add reader simulator API integration test"
```

---

### Task 6: 全量验证与推送

- [ ] **Step 1: 全量构建与测试**

Run:
```bash
pnpm build
pnpm typecheck
pnpm test
```
Expected: 全部通过

- [ ] **Step 2: 推送**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- 读者视角反馈 ✅ Task 2
- 结构化输出（分数、亮点、疑问、预测）✅ Task 1-2
- Studio UI ✅ Task 4
- 测试覆盖 ✅ Task 2, 4, 5

**Placeholder scan:** 无 TBD/TODO/"implement later"。

**Type consistency:**
- `SimulateReaderOptions` / `SimulateReaderResult` 在 core types 定义，Studio client 复用 core 导出类型。
- API 路由与 client 方法签名一致。
