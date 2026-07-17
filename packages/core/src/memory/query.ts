import type { Book } from "../models/book.js";
import type { GraphNode } from "../graph/types.js";
import type { EmbeddingStore } from "../embeddings/store.js";

export interface SimilarNodesOptions {
  queryText: string;
  nodeTypes?: string[];
  topK?: number;
  threshold?: number;
}

export async function similarNodes(
  book: Book,
  embeddingStore: EmbeddingStore,
  options: SimilarNodesOptions
): Promise<GraphNode[]> {
  const [queryVector] = await embeddingStore.embed([options.queryText]);
  const results = await embeddingStore.findSimilar(book.id, queryVector, {
    topK: options.topK ?? 10,
    threshold: options.threshold ?? 0,
  });

  const nodes: Array<{ node: GraphNode; score: number }> = [];
  for (const result of results) {
    const node = book.store.getNode(book.id, result.nodeId);
    if (!node) continue;
    if (options.nodeTypes && !options.nodeTypes.includes(node.type)) continue;
    nodes.push({ node, score: result.score });
  }

  return nodes.sort((a, b) => b.score - a.score).map((item) => item.node);
}
