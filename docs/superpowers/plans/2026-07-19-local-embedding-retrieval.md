# 本地嵌入检索增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 YanStory 的本地语义检索可用、可配置、可感知：FastEmbed 模型下载可指定缓存目录，嵌入向量记录模型版本并在模型/维度变化时自动失效重算，Studio 提供检索状态与重新嵌入入口。

**Architecture:** 复用已有的 `EmbeddingProvider` + `EmbeddingStore` + `/books/:id/search` 链路。核心改动是把 `ResolvedEmbeddingConfig.cacheDir` 透传给 FastEmbed，给 Provider 增加 `model()` 标识，并在 `ensureEmbeddings` 中校验 `embeddings` 表里存储的模型/维度是否与当前 Provider 一致；不一致时重新生成。Studio 增加 `/books/:id/embedding-config` 读写接口和 Explore 搜索面板的模型状态/重新嵌入按钮。

**Tech Stack:** TypeScript, pnpm workspace, better-sqlite3, FastEmbed, Hono, React, Vitest

---

## 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 模型后端 | 继续用 FastEmbed | 已在 core 依赖中，支持离线运行；不再引入 Transformers.js 避免额外构建体积。 |
| 缓存目录 | 透传 `cacheDir` 到 `FlagEmbedding.init` | 用户可配置模型下载位置，默认沿用 FastEmbed 自身默认路径。 |
| 向量失效策略 | 按 `model` + `dimension` 校验 | MVP 最稳：只要模型名或维度不同就重算；不保留多版本向量。 |
| 状态入口 | Explore > Search 面板增加状态栏 | 与现有语义搜索放在同一界面，用户最自然。 |
| 测试 | hash stub + 手动构造 EmbedRecord | 避免在测试中下载真实模型；FastEmbed 路径用最小单元测试覆盖初始化参数。 |

---

## 文件映射

### Core

| 动作 | 文件 | 职责 |
|---|---|---|
| 修改 | `packages/core/src/embeddings/types.ts` | `EmbeddingProvider` 增加 `model(): string` |
| 修改 | `packages/core/src/embeddings/stub.ts` | `HashEmbeddingProvider` 实现 `model()` |
| 修改 | `packages/core/src/embeddings/provider.ts` | `FastEmbedProvider` 接收并透传 `cacheDir`，实现 `model()` |
| 修改 | `packages/core/src/embeddings/factory.ts` | 构造 FastEmbedProvider 时传入 `cacheDir` |
| 修改 | `packages/core/src/models/book.ts` | `ensureEmbeddings` 按当前 Provider 的 model/dimension 校验并跳过/覆盖失效向量 |
| 修改 | `packages/core/src/embeddings/store.ts` | 可选：按 model 删除 embeddings，辅助重算 |
| 创建 | `packages/core/src/embeddings/__tests__/provider.test.ts` | FastEmbedProvider 初始化与 model() 测试 |
| 修改 | `packages/core/src/models/__tests__/book.test.ts` | 新增 ensureEmbeddings 失效与跳过逻辑测试 |

### Studio API

| 动作 | 文件 | 职责 |
|---|---|---|
| 创建 | `packages/studio/src/api/routes/embeddings.ts` | `GET /:id/embedding-config`、`POST /:id/reindex-embeddings` |
| 修改 | `packages/studio/src/api/index.ts` | 挂载 embeddings 路由 |
| 修改 | `packages/studio/src/api/book-manager.ts` | 支持按配置重新创建 Provider 并 reopen book |
| 修改 | `packages/studio/src/api/client.ts` | 新增 embedding config 类型与 API 方法 |
| 修改 | `packages/studio/src/api/__tests__/api.test.ts` | 新增 embedding config / reindex 接口测试 |

### Studio UI

| 动作 | 文件 | 职责 |
|---|---|---|
| 修改 | `packages/studio/src/components/ExplorePanel.tsx` | SearchPanel 顶部显示当前 embedding model、维度、重新嵌入按钮 |
| 创建 | `packages/studio/src/components/__tests__/ExplorePanel.test.tsx`（或扩展已有） | 测试状态显示与 reindex 按钮调用 |

---

## 类型定义

### `packages/core/src/embeddings/types.ts`

```ts
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimension(): number;
  model(): string;
}
```

### `packages/studio/src/api/client.ts`

```ts
export interface EmbeddingConfigInfo {
  provider: "fastembed" | "hash";
  model: string;
  dimension: number;
  cacheDir?: string;
}
```

---

## Core 操作

### `packages/core/src/embeddings/provider.ts`

```ts
import { FlagEmbedding, EmbeddingModel } from "fastembed";
import type { EmbeddingProvider } from "./types.js";

const DEFAULT_MODEL = EmbeddingModel.BGESmallENV15;

type StandardEmbeddingModel =
  | EmbeddingModel.AllMiniLML6V2
  | EmbeddingModel.BGEBaseEN
  | EmbeddingModel.BGEBaseENV15
  | EmbeddingModel.BGESmallEN
  | EmbeddingModel.BGESmallENV15
  | EmbeddingModel.BGESmallZH
  | EmbeddingModel.MLE5Large;

export class FastEmbedProvider implements EmbeddingProvider {
  private model?: FlagEmbedding;
  private readonly modelName: StandardEmbeddingModel;
  private readonly dimensionValue: number;
  private readonly cacheDir?: string;

  constructor(modelName: StandardEmbeddingModel = DEFAULT_MODEL, dimension = 384, cacheDir?: string) {
    this.modelName = modelName;
    this.dimensionValue = dimension;
    this.cacheDir = cacheDir;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      const initOptions: { model: StandardEmbeddingModel; cacheDir?: string } = { model: this.modelName };
      if (this.cacheDir) initOptions.cacheDir = this.cacheDir;
      this.model = await FlagEmbedding.init(initOptions);
    }

    const results: number[][] = [];
    const batchSize = 16;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const generator = this.model.embed(batch, batchSize);
      for await (const vectors of generator) {
        results.push(...vectors);
      }
    }

    return results;
  }

  dimension(): number {
    return this.dimensionValue;
  }

  model(): string {
    return this.modelName;
  }
}
```

### `packages/core/src/embeddings/stub.ts`

在 `HashEmbeddingProvider` 中增加：

```ts
model(): string {
  return "hash";
}
```

### `packages/core/src/embeddings/factory.ts`

```ts
return new FastEmbedProvider(modelName, config.dimension, config.cacheDir);
```

### `packages/core/src/models/book.ts`

修改 `ensureEmbeddings`：

1. 获取当前 provider 的 `model()` 与 `dimension()`。
2. 查询待嵌入节点时，同时读取 `embeddingStore.get(bookId, node.id)`。
3. 若记录存在但 `record.model !== currentModel` 或 `record.vector.length !== currentDimension`，视为失效，加入待重算列表。
4. 嵌入完成后写入 `model: currentModel`。

```ts
const model = this.embeddingProvider.model();
const dimension = this.embeddingProvider.dimension();

const nodesNeedingEmbeddings = nodes.filter((node) => {
  const existing = this.embeddingStore!.get(this.id, node.id);
  if (!existing) return true;
  return existing.model !== model || existing.vector.length !== dimension;
});
```

写入时：

```ts
await this.embeddingStore.upsert({
  id: randomUUID(),
  bookId: this.id,
  nodeId: nodesNeedingEmbeddings[i].id,
  model,
  vector: vectors[i],
  createdAt: now,
});
```

### `packages/core/src/embeddings/store.ts`

新增按 model 删除方法（用于重新嵌入旧模型向量）：

```ts
deleteByModel(bookId: string, model: string): void {
  const stmt = this.store.prepare("DELETE FROM embeddings WHERE book_id = ? AND model = ?");
  stmt.run(bookId, model);
}
```

---

## Studio API

### `packages/studio/src/api/routes/embeddings.ts`

```ts
import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createEmbeddingsRoutes(manager: BookManager) {
  const app = new Hono();

  app.get("/:id/embedding-config", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const provider = book.getEmbeddingStore()?.["provider"];
    // 更稳妥：在 EmbeddingStore 暴露 provider 或从 manager 读取 config
    const config = manager.getEmbeddingConfig();
    return c.json({ config });
  });

  app.post("/:id/reindex-embeddings", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const nodeTypes = Array.isArray(body.nodeTypes) ? body.nodeTypes.map(String) : undefined;
    const book = await manager.getBook(bookId);
    await book.ensureEmbeddings(nodeTypes);
    return c.json({ ok: true });
  });

  return app;
}
```

> 注：`manager.getEmbeddingConfig()` 需要在 `BookManager` 中暴露当前 resolved embedding config。

### `packages/studio/src/api/book-manager.ts`

暴露当前 embedding config：

```ts
getEmbeddingConfig(): ResolvedEmbeddingConfig {
  return this.embeddingConfig;
}
```

（当前 `embeddingConfig` 在 initialize 后已保存。）

---

## Studio UI

### `packages/studio/src/components/ExplorePanel.tsx`

在 `SearchPanel` 顶部增加：

```tsx
const [config, setConfig] = useState<EmbeddingConfigInfo | null>(null);

async function loadConfig() {
  const result = await api.getEmbeddingConfig(book.id);
  setConfig(result.config);
}

async function reindex() {
  setLoading(true);
  try {
    await api.reindexEmbeddings(book.id);
    await loadConfig();
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  void loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [book.id]);
```

渲染：

```tsx
{config && (
  <div style={{ marginBottom: 16, fontSize: 12, color: "#6b7280" }}>
    Embedding: {config.provider} / {config.model} ({config.dimension}d)
    {" "}
    <button onClick={reindex} disabled={loading}>Reindex</button>
  </div>
)}
```

### `packages/studio/src/api/client.ts`

```ts
export interface EmbeddingConfigInfo {
  provider: "fastembed" | "hash";
  model: string;
  dimension: number;
  cacheDir?: string;
}

getEmbeddingConfig: (id: string) => fetchJson<{ config: EmbeddingConfigInfo }>(`/books/${id}/embedding-config`),

reindexEmbeddings: (id: string, nodeTypes?: string[]) =>
  fetchJson<{ ok: boolean }>(`/books/${id}/reindex-embeddings`, {
    method: "POST",
    body: JSON.stringify({ nodeTypes }),
  }),
```

---

## 测试策略

### Core 单元测试

1. **`packages/core/src/embeddings/__tests__/provider.test.ts`**
   - `FastEmbedProvider.model()` 返回构造时传入的模型名。
   - `HashEmbeddingProvider.model()` 返回 `"hash"`。

2. **`packages/core/src/models/__tests__/book.test.ts`**
   - 使用 hash provider 创建 book，调用 `ensureEmbeddings` 后 `embeddingStore.get(...).model` 为 `"hash"`。
   - 切换 provider（构造新 Book 并 setEmbeddingProvider 为不同 dimension 的 hash），再次 `ensureEmbeddings` 会覆盖旧向量。

### Studio API 集成测试

在 `packages/studio/src/api/__tests__/api.test.ts` 新增：

- `GET /books/:id/embedding-config` 返回 provider/model/dimension。
- `POST /books/:id/reindex-embeddings` 返回 `ok: true`。

### Studio 组件测试

扩展 `packages/studio/src/components/__tests__/ExplorePanel.test.tsx`（如不存在则创建）：

- 渲染 SearchPanel 后显示当前 embedding model。
- 点击 Reindex 调用 `api.reindexEmbeddings`。

---

## 验证步骤

```bash
pnpm -r typecheck
pnpm --filter @yanstory/core test
pnpm --filter @yanstory/studio test
```

全部通过后再运行：

```bash
pnpm build
```

人工冒烟（stub 模式）：

```bash
YANSTORY_STUB=true pnpm --filter @yanstory/studio dev
```

打开一本书，进入 **Explore > Search**：
1. 确认状态栏显示当前 embedding provider / model / dimension。
2. 输入查询词搜索，确认返回结果。
3. 点击 **Reindex**，确认无报错，再次搜索一致。

---

## 最关键实现文件

- `packages/core/src/embeddings/provider.ts`
- `packages/core/src/embeddings/types.ts`
- `packages/core/src/models/book.ts`
- `packages/studio/src/api/routes/embeddings.ts`
- `packages/studio/src/components/ExplorePanel.tsx`
