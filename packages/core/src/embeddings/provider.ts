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

  constructor(modelName: StandardEmbeddingModel = DEFAULT_MODEL, dimension = 384) {
    this.modelName = modelName;
    this.dimensionValue = dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      this.model = await FlagEmbedding.init({ model: this.modelName });
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
}
