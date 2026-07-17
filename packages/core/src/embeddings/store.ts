import type { GraphStore } from "../graph/store.js";
import type { EmbeddingProvider, EmbedRecord, SimilarityResult } from "./types.js";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class EmbeddingStore {
  constructor(
    private readonly store: GraphStore,
    private readonly provider: EmbeddingProvider
  ) {}

  get dimension(): number {
    return this.provider.dimension();
  }

  async upsert(record: EmbedRecord): Promise<void> {
    const stmt = this.store.prepare(
      `INSERT INTO embeddings (id, book_id, node_id, model, vector, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id, node_id) DO UPDATE SET
         model = excluded.model,
         vector = excluded.vector,
         created_at = excluded.created_at`
    );
    stmt.run(
      record.id,
      record.bookId,
      record.nodeId,
      record.model,
      JSON.stringify(record.vector),
      record.createdAt
    );
  }

  get(bookId: string, nodeId: string): EmbedRecord | undefined {
    const stmt = this.store.prepare(
      "SELECT * FROM embeddings WHERE book_id = ? AND node_id = ?"
    );
    const row = stmt.get(bookId, nodeId) as Record<string, unknown> | undefined;
    return row ? this.rowToRecord(row) : undefined;
  }

  list(bookId: string): EmbedRecord[] {
    const stmt = this.store.prepare("SELECT * FROM embeddings WHERE book_id = ?");
    const rows = stmt.all(bookId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToRecord(row));
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.provider.embed(texts);
  }

  async findSimilar(
    bookId: string,
    queryVector: number[],
    options: { nodeIds?: string[]; topK?: number; threshold?: number } = {}
  ): Promise<SimilarityResult[]> {
    const { nodeIds, topK = 10, threshold = 0 } = options;
    const candidates = this.list(bookId).filter(
      (record) => !nodeIds || nodeIds.length === 0 || nodeIds.includes(record.nodeId)
    );

    const scored = candidates.map((record) => ({
      nodeId: record.nodeId,
      score: cosineSimilarity(queryVector, record.vector),
    }));

    return scored
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private rowToRecord(row: Record<string, unknown>): EmbedRecord {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      nodeId: String(row.node_id),
      model: String(row.model),
      vector: JSON.parse(String(row.vector)) as number[],
      createdAt: String(row.created_at),
    };
  }
}
