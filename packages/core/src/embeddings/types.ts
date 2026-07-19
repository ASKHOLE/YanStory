export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimension(): number;
  model(): string;
}

export interface EmbedRecord {
  id: string;
  bookId: string;
  nodeId: string;
  model: string;
  vector: number[];
  createdAt: string;
}

export interface SimilarityQuery {
  bookId: string;
  queryText: string;
  nodeTypes?: string[];
  topK?: number;
  threshold?: number;
}

export interface SimilarityResult {
  nodeId: string;
  score: number;
}
