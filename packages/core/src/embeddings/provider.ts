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
  private instance?: FlagEmbedding;
  private readonly modelName: StandardEmbeddingModel;
  private readonly dimensionValue: number;
  private readonly cacheDir?: string;

  constructor(modelName: StandardEmbeddingModel = DEFAULT_MODEL, dimension = 384, cacheDir?: string) {
    this.modelName = modelName;
    this.dimensionValue = dimension;
    this.cacheDir = cacheDir;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.instance) {
      const initOptions: { model: StandardEmbeddingModel; cacheDir?: string } = { model: this.modelName };
      if (this.cacheDir) initOptions.cacheDir = this.cacheDir;
      this.instance = await FlagEmbedding.init(initOptions);
    }

    const results: number[][] = [];
    const batchSize = 16;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const generator = this.instance.embed(batch, batchSize);
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
