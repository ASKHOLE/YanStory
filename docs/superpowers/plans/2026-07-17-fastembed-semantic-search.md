# FastEmbed 真实语义检索接入计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 YanStory 默认使用 FastEmbed 真实语义模型进行检索，同时保留 HashEmbeddingProvider 作为离线/测试回退，支持通过环境变量或 `.yanstory/secrets.json` 配置模型。

**Architecture:** 复用已有的 `FastEmbedProvider` 和 `EmbeddingStore`，在 `BookManager` 初始化时根据项目配置创建对应的 `EmbeddingProvider`。配置解析复用 core 的 secrets/config 机制，与 LLM 配置对齐。测试强制使用 `HashEmbeddingProvider` 以避免下载真实模型。

**Tech Stack:** TypeScript, FastEmbed (`fastembed`), Vitest, Hono, React

---

## File Mapping

| 文件 | 职责 |
|---|---|
| `packages/core/src/project/config.ts` | 扩展 secrets schema，增加 embedding 配置解析 |
| `packages/core/src/embeddings/factory.ts` | 根据配置创建 `FastEmbedProvider` 或 `HashEmbeddingProvider` |
| `packages/core/src/embeddings/index.ts` | 导出 factory 和已有 provider |
| `packages/studio/src/api/book-manager.ts` | 使用解析后的 embedding 配置创建 provider |
| `packages/studio/src/api/__tests__/api.test.ts` | 显式传入 `HashEmbeddingProvider`，避免 CI 下载模型 |
| `packages/core/src/project/__tests__/config.test.ts` | 增加 embedding 配置解析测试 |
| `packages/core/src/embeddings/__tests__/factory.test.ts` | 增加 provider factory 测试 |

---

### Task 1: 扩展 core 配置支持 embedding

**Files:**
- Modify: `packages/core/src/project/config.ts`
- Test: `packages/core/src/project/__tests__/config.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { resolveEmbeddingConfig } from "../config.js";

describe("resolveEmbeddingConfig", () => {
  it("defaults to fastembed with bge-small-zh", () => {
    const config = resolveEmbeddingConfig({});
    expect(config.provider).toBe("fastembed");
    expect(config.model).toBe("bge-small-zh");
    expect(config.dimension).toBe(384);
  });

  it("reads from secrets", () => {
    const config = resolveEmbeddingConfig({
      embedding: { provider: "hash" },
    });
    expect(config.provider).toBe("hash");
  });

  it("reads from env", () => {
    const config = resolveEmbeddingConfig({}, { YANSTORY_EMBEDDING_PROVIDER: "hash" });
    expect(config.provider).toBe("hash");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @yanstory/core test -- src/project/__tests__/config.test.ts`
Expected: FAIL - `resolveEmbeddingConfig` not defined

- [ ] **Step 3: 实现配置解析**

在 `packages/core/src/project/config.ts` 中：

```ts
export const EmbeddingConfigSchema = z.object({
  provider: z.enum(["fastembed", "hash"]).optional(),
  model: z.string().optional(),
  dimension: z.number().int().positive().optional(),
  cacheDir: z.string().optional(),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

export interface ResolvedEmbeddingConfig {
  provider: "fastembed" | "hash";
  model: string;
  dimension: number;
  cacheDir?: string;
}

export function resolveEmbeddingConfig(
  secrets: Secrets,
  env: NodeJS.ProcessEnv = process.env
): ResolvedEmbeddingConfig {
  const embedding = secrets.embedding;
  return {
    provider: (env.YANSTORY_EMBEDDING_PROVIDER ?? embedding?.provider ?? "fastembed") as "fastembed" | "hash",
    model: env.YANSTORY_EMBEDDING_MODEL ?? embedding?.model ?? "bge-small-zh",
    dimension: env.YANSTORY_EMBEDDING_DIMENSION ? Number(env.YANSTORY_EMBEDDING_DIMENSION) : (embedding?.dimension ?? 384),
    cacheDir: embedding?.cacheDir,
  };
}
```

同时扩展 `SecretsSchema`：

```ts
export const SecretsSchema = z.object({
  llm: LLMConfigSchema.optional(),
  embedding: EmbeddingConfigSchema.optional(),
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @yanstory/core test -- src/project/__tests__/config.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/project/config.ts packages/core/src/project/__tests__/config.test.ts
git commit -m "feat: add embedding config resolution"
```

---

### Task 2: 实现 EmbeddingProvider factory

**Files:**
- Create: `packages/core/src/embeddings/factory.ts`
- Modify: `packages/core/src/embeddings/index.ts`
- Test: `packages/core/src/embeddings/__tests__/factory.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { createEmbeddingProvider, HashEmbeddingProvider } from "../factory.js";
import type { ResolvedEmbeddingConfig } from "../../project/config.js";

describe("createEmbeddingProvider", () => {
  it("creates hash provider", () => {
    const provider = createEmbeddingProvider({ provider: "hash", model: "", dimension: 384 });
    expect(provider).toBeInstanceOf(HashEmbeddingProvider);
  });

  it("creates fastembed provider for known model", () => {
    const provider = createEmbeddingProvider({ provider: "fastembed", model: "bge-small-zh", dimension: 384 });
    expect(provider).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @yanstory/core test -- src/embeddings/__tests__/factory.test.ts`
Expected: FAIL - `factory.js` not found

- [ ] **Step 3: 实现 factory**

创建 `packages/core/src/embeddings/factory.ts`：

```ts
import { EmbeddingModel, FlagEmbedding } from "fastembed";
import type { ResolvedEmbeddingConfig } from "../project/config.js";
import type { EmbeddingProvider } from "./types.js";
import { HashEmbeddingProvider } from "./provider.js";

const MODEL_ALIASES: Record<string, EmbeddingModel> = {
  "bge-small-zh": EmbeddingModel.BGESmallZH,
  "bge-small-en": EmbeddingModel.BGESmallEN,
  "bge-small-en-v1.5": EmbeddingModel.BGESmallENV15,
  "bge-base-en": EmbeddingModel.BGEBaseEN,
  "bge-base-en-v1.5": EmbeddingModel.BGEBaseENV15,
  "all-MiniLM-L6-v2": EmbeddingModel.AllMiniLML6V2,
};

function resolveModelName(model: string): EmbeddingModel {
  if (Object.values(EmbeddingModel).includes(model as EmbeddingModel)) {
    return model as EmbeddingModel;
  }
  const alias = MODEL_ALIASES[model.toLowerCase()];
  if (alias) return alias;
  throw new Error(`Unsupported embedding model: ${model}`);
}

export function createEmbeddingProvider(config: ResolvedEmbeddingConfig): EmbeddingProvider {
  if (config.provider === "hash") {
    return new HashEmbeddingProvider();
  }
  const modelName = resolveModelName(config.model);
  return new (class implements EmbeddingProvider {
    private model?: FlagEmbedding;
    private readonly modelName = modelName;
    private readonly dimensionValue = config.dimension;

    async embed(texts: string[]): Promise<number[][]> {
      if (!this.model) {
        const initOptions: { model: EmbeddingModel; cacheDir?: string } = { model: this.modelName };
        if (config.cacheDir) initOptions.cacheDir = config.cacheDir;
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
  })();
}
```

- [ ] **Step 4: 更新导出**

在 `packages/core/src/embeddings/index.ts` 中：

```ts
export { createEmbeddingProvider } from "./factory.js";
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @yanstory/core test -- src/embeddings/__tests__/factory.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/embeddings/factory.ts packages/core/src/embeddings/index.ts packages/core/src/embeddings/__tests__/factory.test.ts
git commit -m "feat: add embedding provider factory"
```

---

### Task 3: BookManager 默认使用配置化 EmbeddingProvider

**Files:**
- Modify: `packages/studio/src/api/book-manager.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 修改 BookManager**

在 `packages/studio/src/api/book-manager.ts` 中：

```ts
import {
  ...,
  resolveEmbeddingConfig,
  createEmbeddingProvider,
  type ResolvedEmbeddingConfig,
} from "@yanstory/core";

export interface BookManagerOptions {
  projectRoot: string;
  useStub?: boolean;
  embeddingProvider?: EmbeddingProvider;
}

export class BookManager {
  ...
  private embeddingConfig: ResolvedEmbeddingConfig;

  constructor(options: BookManagerOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.useStub = options.useStub ?? false;
    this.embeddingProvider = options.embeddingProvider ?? createHashEmbeddingProvider();
    this.embeddingConfig = resolveEmbeddingConfig({});
  }

  async initialize(): Promise<void> {
    await ensureProjectLayout(this.projectRoot);
    const secrets = await loadSecrets(this.projectRoot);
    this.embeddingConfig = resolveEmbeddingConfig(secrets);
    if (!this.embeddingProviderSetExternally()) {
      this.embeddingProvider = createEmbeddingProvider(this.embeddingConfig);
    }
    if (!this.useStub) {
      const config = resolveLLMConfig(secrets);
      this.llmClient = createLLMClient(config);
    }
  }

  private embeddingProviderSetExternally(): boolean {
    return !(this.embeddingProvider instanceof HashEmbeddingProvider);
  }
}
```

注意：如果构造函数已传入 provider（如测试传入 HashEmbeddingProvider），则 initialize 不再覆盖。

- [ ] **Step 2: 导出新增类型/函数**

在 `packages/core/src/index.ts` 中：

```ts
export { resolveEmbeddingConfig, createEmbeddingProvider } from "./project/config.js";
export type { ResolvedEmbeddingConfig, EmbeddingConfig } from "./project/config.js";
```

- [ ] **Step 3: 运行 Studio 测试**

Run: `pnpm --filter @yanstory/studio test -- src/api/__tests__/api.test.ts`
Expected: PASS（测试未显式传 provider，仍会使用 hash 作为构造函数默认值）

- [ ] **Step 4: 提交**

```bash
git add packages/studio/src/api/book-manager.ts packages/core/src/index.ts
git commit -m "feat: BookManager resolves embedding provider from config"
```

---

### Task 4: 显式在 Studio API 测试中使用 HashEmbeddingProvider

**Files:**
- Modify: `packages/studio/src/api/__tests__/api.test.ts`

- [ ] **Step 1: 修改测试初始化**

```ts
import { ..., createHashEmbeddingProvider } from "@yanstory/core";

beforeEach(async () => {
  projectRoot = await createTempDir();
  manager = new BookManager({
    projectRoot,
    useStub: true,
    embeddingProvider: createHashEmbeddingProvider(),
  });
  await manager.initialize();
});
```

- [ ] **Step 2: 运行测试**

Run: `pnpm --filter @yanstory/studio test -- src/api/__tests__/api.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/studio/src/api/__tests__/api.test.ts
git commit -m "test: use hash embedding provider in API tests to avoid model download"
```

---

### Task 5: 验证与最终提交

- [ ] **Step 1: 全量构建与测试**

Run:
```bash
pnpm build
pnpm typecheck
pnpm test
```
Expected: 全部通过

- [ ] **Step 2: 检查工作区**

Run:
```bash
git status
git diff --stat
```
Expected: 干净，无意外文件

- [ ] **Step 3: 提交（如尚未提交）并推送**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- 支持 FastEmbed 真实语义模型 ✅ Task 2 + 3
- 支持 HashEmbeddingProvider 回退 ✅ Task 2
- 支持配置（env + secrets.json）✅ Task 1
- 测试避免下载模型 ✅ Task 4

**Placeholder scan:** 无 TBD/TODO/"implement later"。

**Type consistency:**
- `ResolvedEmbeddingConfig` 在 Task 1 定义，Task 2/3 使用同一类型。
- `createEmbeddingProvider` 签名一致。
