import { describe, it, expect } from "vitest";
import { createEmbeddingProvider, HashEmbeddingProvider } from "../factory.js";
import type { ResolvedEmbeddingConfig } from "../../project/config.js";

describe("createEmbeddingProvider", () => {
  it("creates hash provider", () => {
    const config: ResolvedEmbeddingConfig = { provider: "hash", model: "", dimension: 384 };
    const provider = createEmbeddingProvider(config);
    expect(provider).toBeInstanceOf(HashEmbeddingProvider);
    expect(provider.dimension()).toBe(384);
  });

  it("creates fastembed provider for known zh model", () => {
    const config: ResolvedEmbeddingConfig = { provider: "fastembed", model: "bge-small-zh", dimension: 384 };
    const provider = createEmbeddingProvider(config);
    expect(provider).not.toBeInstanceOf(HashEmbeddingProvider);
    expect(provider.dimension()).toBe(384);
  });

  it("creates fastembed provider for exact model id", () => {
    const config: ResolvedEmbeddingConfig = {
      provider: "fastembed",
      model: "BAAI/bge-small-zh-v1.5",
      dimension: 512,
    };
    const provider = createEmbeddingProvider(config);
    expect(provider).not.toBeInstanceOf(HashEmbeddingProvider);
    expect(provider.dimension()).toBe(512);
  });

  it("throws for unsupported model", () => {
    const config: ResolvedEmbeddingConfig = { provider: "fastembed", model: "unknown-model", dimension: 384 };
    expect(() => createEmbeddingProvider(config)).toThrow("Unsupported embedding model");
  });
});
