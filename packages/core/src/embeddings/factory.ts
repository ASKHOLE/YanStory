import { EmbeddingModel } from "fastembed";
import type { ResolvedEmbeddingConfig } from "../project/config.js";
import { FastEmbedProvider } from "./provider.js";
import { HashEmbeddingProvider } from "./stub.js";
import type { EmbeddingProvider } from "./types.js";

type StandardEmbeddingModel =
  | EmbeddingModel.AllMiniLML6V2
  | EmbeddingModel.BGEBaseEN
  | EmbeddingModel.BGEBaseENV15
  | EmbeddingModel.BGESmallEN
  | EmbeddingModel.BGESmallENV15
  | EmbeddingModel.BGESmallZH
  | EmbeddingModel.MLE5Large;

const MODEL_ALIASES: Record<string, StandardEmbeddingModel> = {
  "bge-small-zh": EmbeddingModel.BGESmallZH,
  "bge-small-en": EmbeddingModel.BGESmallEN,
  "bge-small-en-v1.5": EmbeddingModel.BGESmallENV15,
  "bge-base-en": EmbeddingModel.BGEBaseEN,
  "bge-base-en-v1.5": EmbeddingModel.BGEBaseENV15,
  "all-minilm-l6-v2": EmbeddingModel.AllMiniLML6V2,
  "all-minilm-l6": EmbeddingModel.AllMiniLML6V2,
  "mle5-large": EmbeddingModel.MLE5Large,
  "baai/bge-small-zh-v1.5": EmbeddingModel.BGESmallZH,
  "baai/bge-small-en-v1.5": EmbeddingModel.BGESmallENV15,
  "baai/bge-base-en-v1.5": EmbeddingModel.BGEBaseENV15,
  "sentence-transformers/all-minilm-l6-v2": EmbeddingModel.AllMiniLML6V2,
};

function resolveModelName(model: string): StandardEmbeddingModel {
  const normalized = model.toLowerCase().trim();
  if (Object.values(EmbeddingModel).includes(model as EmbeddingModel)) {
    return model as StandardEmbeddingModel;
  }
  const alias = MODEL_ALIASES[normalized];
  if (alias) return alias;
  throw new Error(`Unsupported embedding model: ${model}`);
}

export function createEmbeddingProvider(config: ResolvedEmbeddingConfig): EmbeddingProvider {
  if (config.provider === "hash") {
    return new HashEmbeddingProvider(config.dimension);
  }
  const modelName = resolveModelName(config.model);
  return new FastEmbedProvider(modelName, config.dimension, config.cacheDir);
}

export { HashEmbeddingProvider, FastEmbedProvider };
