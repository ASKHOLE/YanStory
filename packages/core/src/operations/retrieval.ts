import type { Book } from "../models/book.js";
import { similarNodes } from "../memory/query.js";

export interface RetrievalOptions {
  queryText: string;
  nodeTypes?: string[];
  topK?: number;
  threshold?: number;
}

export async function buildRetrievalContext(
  book: Book,
  options: RetrievalOptions
): Promise<string> {
  const embeddingStore = book.getEmbeddingStore();
  if (!embeddingStore) {
    return "";
  }

  await book.ensureEmbeddings(options.nodeTypes);

  const nodes = await similarNodes(book, embeddingStore, {
    queryText: options.queryText,
    nodeTypes: options.nodeTypes,
    topK: options.topK ?? 5,
    threshold: options.threshold ?? 0.5,
  });

  if (nodes.length === 0) {
    return "";
  }

  const lines = nodes.map((node) => {
    const summary = node.properties.summary ? ` — ${node.properties.summary}` : "";
    return `- ${node.type}: ${node.label}${summary}`;
  });

  return ["Relevant context from the story graph:", ...lines].join("\n");
}
