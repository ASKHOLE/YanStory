import type { EmbeddingProvider } from "./types.js";

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  private readonly dimensionValue: number;

  constructor(dimension = 384) {
    this.dimensionValue = dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedSingle(text));
  }

  dimension(): number {
    return this.dimensionValue;
  }

  private embedSingle(text: string): number[] {
    const vector = new Array(this.dimensionValue).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean);

    for (const word of words) {
      for (let i = 0; i < word.length; i++) {
        const char = word.charCodeAt(i);
        const idx = char % this.dimensionValue;
        vector[idx] += 1;
      }
    }

    return normalizeVector(vector);
  }
}

export function createHashEmbeddingProvider(dimension?: number): EmbeddingProvider {
  return new HashEmbeddingProvider(dimension);
}
