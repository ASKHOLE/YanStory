import { describe, it, expect, vi } from "vitest";
import { FlagEmbedding, EmbeddingModel } from "fastembed";
import { FastEmbedProvider, HashEmbeddingProvider, createHashEmbeddingProvider } from "../index.js";

describe("FastEmbedProvider", () => {
  it("returns the configured model name and dimension", () => {
    const provider = new FastEmbedProvider(EmbeddingModel.BGESmallENV15, 384);
    expect(provider.model()).toBe(EmbeddingModel.BGESmallENV15);
    expect(provider.dimension()).toBe(384);
  });

  it("passes cacheDir to FlagEmbedding.init", async () => {
    const embedMock = vi.fn().mockImplementation(async function* () {
      yield [[0.1, 0.2, 0.3]];
    });
    const initMock = vi.spyOn(FlagEmbedding, "init").mockResolvedValue({
      embed: embedMock,
    } as unknown as FlagEmbedding);

    const provider = new FastEmbedProvider(EmbeddingModel.BGESmallENV15, 3, "/tmp/embed-cache");
    const vectors = await provider.embed(["hello"]);

    expect(initMock).toHaveBeenCalledWith({
      model: EmbeddingModel.BGESmallENV15,
      cacheDir: "/tmp/embed-cache",
    });
    expect(vectors).toEqual([[0.1, 0.2, 0.3]]);

    initMock.mockRestore();
  });
});

describe("HashEmbeddingProvider", () => {
  it("identifies itself as hash", () => {
    const provider = createHashEmbeddingProvider(128);
    expect(provider.model()).toBe("hash");
    expect(provider.dimension()).toBe(128);
  });
});
