import { randomUUID } from "node:crypto";
import type { Book } from "../models/book.js";
import type { GraphEdge, GraphNode } from "../graph/types.js";
import type {
  AddClueOptions,
  ClueItem,
  ClueTimelineItem,
  ResolveClueOptions,
} from "./types.js";

function now(): string {
  return new Date().toISOString();
}

function assertNodeExists(book: Book, id: string, name: string): void {
  const node = book.store.getNode(book.id, id);
  if (!node) {
    throw new Error(`${name} node not found: ${id}`);
  }
}

function getSingleEdge(edges: GraphEdge[], type: GraphEdge["type"]): GraphEdge | undefined {
  return edges.find((edge) => edge.type === type);
}

function toClueItem(book: Book, node: GraphNode): ClueItem {
  const edges = book.store.findEdges({ bookId: book.id, fromId: node.id });
  const planted = getSingleEdge(edges, "planted_in");
  const payoff = getSingleEdge(edges, "pays_off");
  const foreshadows = getSingleEdge(edges, "foreshadows");

  return {
    id: node.id,
    label: node.label,
    description: String(node.properties.description ?? ""),
    status: node.properties.status === "resolved" ? "resolved" : "planted",
    plantAt: planted?.toId ?? "",
    resolveAt: payoff?.toId ?? null,
    targetId: foreshadows?.toId ?? null,
    order: Number(node.properties.order ?? 0),
    createdAt: node.createdAt,
  };
}

export async function addClue(book: Book, options: AddClueOptions): Promise<ClueItem> {
  assertNodeExists(book, options.plantAt, "plantAt");
  if (options.resolveAt) assertNodeExists(book, options.resolveAt, "resolveAt");
  if (options.targetId) assertNodeExists(book, options.targetId, "targetId");

  const id = `clue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = now();
  const status = options.resolveAt ? "resolved" : "planted";

  const node: GraphNode = {
    id,
    bookId: book.id,
    type: "clue",
    label: options.label,
    contentUri: null,
    properties: {
      description: options.description ?? "",
      status,
      order: options.order ?? 0,
    },
    createdAt,
    updatedAt: createdAt,
  };

  book.store.transaction(() => {
    book.store.createNode(node);
    book.store.createEdge({
      id: randomUUID(),
      bookId: book.id,
      type: "planted_in",
      fromId: id,
      toId: options.plantAt,
      properties: {},
      createdAt,
    });
    if (options.resolveAt) {
      book.store.createEdge({
        id: randomUUID(),
        bookId: book.id,
        type: "pays_off",
        fromId: id,
        toId: options.resolveAt,
        properties: {},
        createdAt,
      });
    }
    if (options.targetId) {
      book.store.createEdge({
        id: randomUUID(),
        bookId: book.id,
        type: "foreshadows",
        fromId: id,
        toId: options.targetId,
        properties: {},
        createdAt,
      });
    }
  });

  return toClueItem(book, node);
}

export async function listClues(book: Book): Promise<ClueItem[]> {
  const clues = book.findNodes("clue");
  return clues
    .map((node) => toClueItem(book, node))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export async function resolveClue(book: Book, options: ResolveClueOptions): Promise<ClueItem> {
  const node = book.store.getNode(book.id, options.clueId);
  if (!node) throw new Error(`Clue not found: ${options.clueId}`);
  if (node.type !== "clue") throw new Error(`Node is not a clue: ${options.clueId}`);
  assertNodeExists(book, options.resolveAt, "resolveAt");

  const existingPayoff = book.store.findEdges({
    bookId: book.id,
    fromId: node.id,
    type: "pays_off",
  });
  if (existingPayoff.length > 0) {
    throw new Error(`Clue already resolved: ${options.clueId}`);
  }

  const createdAt = now();

  book.store.transaction(() => {
    book.store.updateNode(book.id, node.id, {
      properties: { ...node.properties, status: "resolved" },
    });
    book.store.createEdge({
      id: randomUUID(),
      bookId: book.id,
      type: "pays_off",
      fromId: node.id,
      toId: options.resolveAt,
      properties: {},
      createdAt,
    });
  });

  const updated = book.store.getNode(book.id, node.id)!;
  return toClueItem(book, updated);
}

export async function buildClueTimeline(book: Book): Promise<ClueTimelineItem[]> {
  const items = await listClues(book);
  return items.map((item) => {
    const plantNode = book.store.getNode(book.id, item.plantAt);
    const resolveNode = item.resolveAt
      ? book.store.getNode(book.id, item.resolveAt)
      : undefined;
    const targetNode = item.targetId
      ? book.store.getNode(book.id, item.targetId)
      : undefined;

    const timelineItem: ClueTimelineItem = {
      ...item,
      plantLabel: plantNode?.label ?? item.plantAt,
    };
    if (resolveNode) timelineItem.resolveLabel = resolveNode.label;
    if (targetNode) timelineItem.targetLabel = targetNode.label;
    return timelineItem;
  });
}
