# 体裁化批评角色实现计划

> **状态：已实现** — 所有步骤已核对并完成。

**Goal:** 让 YanStory 能按不同批评角色（节奏、人物、世界观、对话、编辑等）对章节给出体裁化批评，返回可执行的结构化建议。

**Architecture:** 复用 `simulateReader` 已验证的 prompt / JSON 解析模式，新增 `critique` 操作。根据书籍体裁（genre）和选择的批评角色构造 prompt，返回评分、优点、缺点、建议、体裁注记。Studio 侧新增 Critique 面板。

**Tech Stack:** TypeScript, Vitest, Hono, React

---

## File Mapping

| 文件 | 职责 |
|---|---|
| `packages/core/src/operations/types.ts` | 新增 `CritiqueOptions`、`CritiqueResult`、`CritiqueScores` 类型 |
| `packages/core/src/operations/critique.ts` | 实现 `critique` 操作与 prompt |
| `packages/core/src/index.ts` | 导出 `critique` 和类型 |
| `packages/core/src/operations/__tests__/critique.test.ts` | 测试 critique 操作 |
| `packages/studio/src/api/routes/critique.ts` | Hono 路由 `POST /books/:id/critique` |
| `packages/studio/src/api/index.ts` | 挂载 critique 路由 |
| `packages/studio/src/api/client.ts` | 前端 API 方法 `critique` |
| `packages/studio/src/components/CritiquePanel.tsx` | 体裁化批评 UI |
| `packages/studio/src/components/BookWorkspace.tsx` | 新增 "critique" 标签 |
| `packages/studio/src/components/__tests__/CritiquePanel.test.tsx` | 组件测试 |
| `packages/studio/src/api/__tests__/api.test.ts` | API 集成测试 |

---

### Task 1: 定义批评操作类型

**Files:**
- Modify: `packages/core/src/operations/types.ts`

- [x] **Step 1: 添加类型**

```ts
export interface CritiqueScores {
  pacing: number;
  character: number;
  worldbuilding: number;
  dialogue: number;
  originality: number;
}

export interface CritiqueOptions {
  target?: string;
  role?: string;
  focus?: string[];
}

export interface CritiqueResult {
  summary: string;
  verdict: "pass" | "revise" | "major-revision";
  scores: CritiqueScores;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  genreNotes: string[];
}
```

- [x] **Step 2: 提交**

```bash
git add packages/core/src/operations/types.ts
git commit -m "feat: add genre critic operation types"
```

---

### Task 2: 实现 `critique` 操作

**Files:**
- Create: `packages/core/src/operations/critique.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/operations/__tests__/critique.test.ts`

- [x] **Step 1: 编写失败测试**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, LLMStub, createHashEmbeddingProvider } from "../../index.js";
import { critique } from "../critique.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-critique-test-"));
}

function createCritiqueStub(): ReturnType<typeof import("../../llm/stub.js").createLLMStub> {
  const stub = new LLMStub();
  stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
    summary: "Solid pacing, weak dialogue.",
    verdict: "revise",
    scores: { pacing: 8, character: 7, worldbuilding: 6, dialogue: 4, originality: 7 },
    strengths: ["Fast opening"],
    weaknesses: ["Dialogue feels generic"],
    suggestions: ["Give the mentor a distinct voice"],
    genreNotes: ["Xuanhuan readers expect clear power progression hints"],
  }));
  return (options) => stub.call(options);
}

describe("critique", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Critique Test", genre: "xuanhuan" });
    book.setLLMClient(createCritiqueStub());
    book.setEmbeddingProvider(createHashEmbeddingProvider());
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("returns structured critique", async () => {
    await book.compose({ intent: "introduce hero", targetWords: 100 });
    const result = await critique(book, { target: "chapter-0001", role: "editor" });
    expect(result.summary).toBeTruthy();
    expect(result.scores.pacing).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @yanstory/core test -- src/operations/__tests__/critique.test.ts`
Expected: FAIL - `critique.js` not found

- [x] **Step 3: 实现操作**

创建 `packages/core/src/operations/critique.ts`：

```ts
import type { Book } from "../models/book.js";
import { buildRetrievalContext } from "./retrieval.js";
import type { CritiqueOptions, CritiqueResult } from "./types.js";

function parseCritiqueJson(content: string): CritiqueResult {
  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: String(parsed.summary ?? ""),
    verdict: ["pass", "revise", "major-revision"].includes(parsed.verdict)
      ? (parsed.verdict as CritiqueResult["verdict"])
      : "revise",
    scores: {
      pacing: Number(parsed.scores?.pacing ?? 0),
      character: Number(parsed.scores?.character ?? 0),
      worldbuilding: Number(parsed.scores?.worldbuilding ?? 0),
      dialogue: Number(parsed.scores?.dialogue ?? 0),
      originality: Number(parsed.scores?.originality ?? 0),
    },
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
    genreNotes: Array.isArray(parsed.genreNotes) ? parsed.genreNotes.map(String) : [],
  };
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor: "a demanding developmental editor",
  pacing: "a pacing specialist focused on narrative momentum",
  character: "a character development coach",
  worldbuilding: "a worldbuilding consultant",
  dialogue: "a dialogue coach",
};

export async function critique(book: Book, options: CritiqueOptions = {}): Promise<CritiqueResult> {
  if (!book.llmClient) {
    throw new Error("LLM client not configured. Call book.setLLMClient(...) before critiquing.");
  }

  const target = options.target ?? "book";
  const markdown = await book.projection(target);
  const retrievalContext = await buildRetrievalContext(book, {
    queryText: markdown,
    nodeTypes: ["character", "location", "event"],
    topK: 5,
  });

  const bookNode = book.getNode("book");
  const genre = (bookNode?.properties.genre as string) ?? "fiction";
  const role = options.role ?? "editor";
  const roleDescription = ROLE_DESCRIPTIONS[role] ?? `a ${role} critic`;
  const focus = options.focus ?? ["pacing", "character", "worldbuilding", "dialogue", "originality"];

  const prompt = [
    `You are ${roleDescription} reviewing a ${genre} novel chapter/scene.`,
    `Focus areas: ${focus.join(", ")}`,
    retrievalContext ? `Relevant context from the story:\n${retrievalContext}` : "",
    "Text to critique:",
    "---",
    markdown,
    "---",
    "Respond ONLY with valid JSON in this exact structure:",
    JSON.stringify({
      summary: "brief overall assessment",
      verdict: "pass | revise | major-revision",
      scores: { pacing: 0, character: 0, worldbuilding: 0, dialogue: 0, originality: 0 },
      strengths: ["strength 1"],
      weaknesses: ["weakness 1"],
      suggestions: ["actionable suggestion 1"],
      genreNotes: ["genre-specific note 1"],
    }),
    "Scores should be integers 1-10. Verdict must be one of: pass, revise, major-revision.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await book.llmClient({ messages: [{ role: "user", content: prompt }] });
  return parseCritiqueJson(response.content);
}
```

- [x] **Step 4: 导出操作**

在 `packages/core/src/index.ts` 中：

```ts
export { critique } from "./operations/critique.js";
export type {
  ...,
  CritiqueOptions,
  CritiqueResult,
  CritiqueScores,
} from "./operations/types.js";
```

- [x] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @yanstory/core test -- src/operations/__tests__/critique.test.ts`
Expected: PASS

- [x] **Step 6: 提交**

```bash
git add packages/core/src/operations/critique.ts packages/core/src/operations/__tests__/critique.test.ts packages/core/src/index.ts packages/core/src/operations/types.ts
git commit -m "feat: implement genre critique operation"
```

---

### Task 3: 添加 Studio API 路由

**Files:**
- Create: `packages/studio/src/api/routes/critique.ts`
- Modify: `packages/studio/src/api/index.ts`
- Modify: `packages/studio/src/api/client.ts`

- [x] **Step 1: 创建路由**

创建 `packages/studio/src/api/routes/critique.ts`：

```ts
import { Hono } from "hono";
import { critique } from "@yanstory/core";
import type { BookManager } from "../book-manager.js";

export function createCritiqueRoutes(manager: BookManager) {
  const app = new Hono();

  app.post("/:id/critique", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const book = await manager.getBook(bookId);
    const result = await critique(book, {
      target: body.target,
      role: body.role,
      focus: body.focus,
    });
    return c.json(result);
  });

  return app;
}
```

- [x] **Step 2: 挂载路由**

在 `packages/studio/src/api/index.ts` 中导入并挂载：

```ts
import { createCritiqueRoutes } from "./routes/critique.js";
app.route("/books", createCritiqueRoutes(manager));
```

- [x] **Step 3: 扩展 client**

在 `packages/studio/src/api/client.ts` 中：

```ts
import type { ..., CritiqueOptions, CritiqueResult } from "@yanstory/core";

critique: (id: string, options?: CritiqueOptions) =>
  fetchJson<CritiqueResult>(`/books/${id}/critique`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  }),
```

- [x] **Step 4: 提交**

```bash
git add packages/studio/src/api/routes/critique.ts packages/studio/src/api/index.ts packages/studio/src/api/client.ts
git commit -m "feat: add genre critique API route and client"
```

---

### Task 4: 实现 CritiquePanel 前端组件

**Files:**
- Create: `packages/studio/src/components/CritiquePanel.tsx`
- Modify: `packages/studio/src/components/BookWorkspace.tsx`
- Test: `packages/studio/src/components/__tests__/CritiquePanel.test.tsx`

- [x] **Step 1: 创建组件**

创建 `packages/studio/src/components/CritiquePanel.tsx`：

```tsx
import { useState } from "react";
import type { BookInfo, CritiqueResult } from "../api/client.js";
import { api } from "../api/client.js";

interface CritiquePanelProps {
  book: BookInfo;
}

export function CritiquePanel({ book }: CritiquePanelProps) {
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CritiqueResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.critique(book.id, {
        target: target || undefined,
        role,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const verdictColor =
    result?.verdict === "pass" ? "#dcfce7" : result?.verdict === "major-revision" ? "#fee2e2" : "#fef9c3";

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
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 180 }}>
            <option value="editor">Developmental Editor</option>
            <option value="pacing">Pacing</option>
            <option value="character">Character</option>
            <option value="worldbuilding">Worldbuilding</option>
            <option value="dialogue">Dialogue</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>{loading ? "Critiquing..." : "Run Critique"}</button>
      </form>

      {result && (
        <div>
          <div
            style={{
              padding: 12,
              background: verdictColor,
              borderRadius: 4,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>{result.summary}</strong>
            <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{result.verdict}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
            {Object.entries(result.scores).map(([key, value]) => (
              <div key={key} style={{ padding: 12, background: "#f9fafb", borderRadius: 4, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{key}</div>
                <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Strengths</h4>
              <ul>{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Weaknesses</h4>
              <ul>{result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          </div>

          <h4 style={{ marginBottom: 8 }}>Suggestions</h4>
          <ul style={{ marginBottom: 16 }}>
            {result.suggestions.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ul>

          <h4 style={{ marginBottom: 8 }}>Genre Notes</h4>
          <ul>
            {result.genreNotes.map((n, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 2: 更新 BookWorkspace**

在 `BookWorkspace.tsx` 中：

```ts
import { CritiquePanel } from "./CritiquePanel.js";
type Tab = "compose" | ... | "critique";
```

标签数组增加 `"critique"`，渲染区增加：

```tsx
{tab === "critique" && <CritiquePanel book={book} />}
```

- [x] **Step 3: 组件测试**

创建 `packages/studio/src/components/__tests__/CritiquePanel.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CritiquePanel } from "../CritiquePanel.js";

const sampleBook = {
  id: "book-1",
  title: "Critique Book",
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

describe("CritiquePanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("runs critique and displays verdict", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        summary: "Solid chapter with pacing issues.",
        verdict: "revise",
        scores: { pacing: 5, character: 8, worldbuilding: 7, dialogue: 6, originality: 7 },
        strengths: ["Strong protagonist voice"],
        weaknesses: ["Middle drags"],
        suggestions: ["Tighten the travel scene"],
        genreNotes: ["Add a cultivation hint"],
      })
    );

    render(<CritiquePanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "Run Critique" }));

    await waitFor(() => {
      expect(screen.getByText("Solid chapter with pacing issues.")).toBeInTheDocument();
    });
    expect(screen.getByText("revise")).toBeInTheDocument();
    expect(screen.getByText("Tighten the travel scene")).toBeInTheDocument();
  });
});
```

- [x] **Step 4: 提交**

```bash
git add packages/studio/src/components/CritiquePanel.tsx packages/studio/src/components/BookWorkspace.tsx packages/studio/src/components/__tests__/CritiquePanel.test.tsx
git commit -m "feat: add CritiquePanel component and workspace tab"
```

---

### Task 5: API 集成测试

**Files:**
- Modify: `packages/studio/src/api/__tests__/api.test.ts`

- [x] **Step 1: 添加测试**

```ts
it("runs a genre critique", async () => {
  const app = createApp();
  const createRes = await app.request("/books", {
    method: "POST",
    body: JSON.stringify({ title: "Critique API Test", genre: "xuanhuan" }),
    headers: { "Content-Type": "application/json" },
  });
  const { id } = await createRes.json();

  const book = await manager.getBook(id);
  const stub = new LLMStub();
  stub.when(/Respond ONLY with valid JSON/, JSON.stringify({
    summary: "Good start.",
    verdict: "revise",
    scores: { pacing: 7, character: 8, worldbuilding: 6, dialogue: 7, originality: 7 },
    strengths: ["Clear setup"],
    weaknesses: ["Slow middle"],
    suggestions: ["Add tension"],
    genreNotes: ["Power system hint expected"],
  }));
  book.setLLMClient((options) => stub.call(options));

  await app.request(`/books/${id}/compose`, {
    method: "POST",
    body: JSON.stringify({ intent: "introduce hero", targetWords: 100 }),
    headers: { "Content-Type": "application/json" },
  });

  const critiqueRes = await app.request(`/books/${id}/critique`, {
    method: "POST",
    body: JSON.stringify({ target: "chapter-0001", role: "editor" }),
    headers: { "Content-Type": "application/json" },
  });
  expect(critiqueRes.status).toBe(200);
  const result = await critiqueRes.json();
  expect(result.summary).toBe("Good start.");
  expect(result.scores.character).toBe(8);
  expect(result.suggestions.length).toBeGreaterThan(0);
});
```

- [x] **Step 2: 运行测试确认通过**

Run: `pnpm --filter @yanstory/studio test -- src/api/__tests__/api.test.ts`
Expected: PASS

- [x] **Step 3: 提交**

```bash
git add packages/studio/src/api/__tests__/api.test.ts
git commit -m "test: add genre critique API integration test"
```

---

### Task 6: 全量验证与推送

- [x] **Step 1: 全量构建与测试**

Run:
```bash
pnpm build
pnpm typecheck
pnpm test
```
Expected: 全部通过

- [x] **Step 2: 推送**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- 多角色体裁批评 ✅ Task 2
- 结构化输出（评分、优点、缺点、建议、体裁注记）✅ Task 1-2
- Studio UI ✅ Task 4
- 测试覆盖 ✅ Task 2, 4, 5

**Placeholder scan:** 无 TBD/TODO/"implement later"。

**Type consistency:**
- `CritiqueOptions` / `CritiqueResult` 在 core types 定义，Studio client 复用 core 导出类型。
- API 路由与 client 方法签名一致。
