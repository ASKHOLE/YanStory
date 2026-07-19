import type { Book } from "../models/book.js";
import type { CausalCondition } from "./types.js";
import type { GraphNode } from "../graph/types.js";
import { resolveConditionChapter } from "./engine.js";

export function resolveCharacter(book: Book, name: string): GraphNode | undefined {
  const nodes = book.findNodes("character");
  return nodes.find(
    (n) => n.label === name || n.id === name || String(n.properties.name ?? "") === name
  );
}

export function resolveKnowledge(book: Book, fact: string): GraphNode | undefined {
  const nodes = book.findNodes("knowledge");
  return nodes.find(
    (n) => n.label === fact || n.id === fact || String(n.properties.fact ?? "") === fact
  );
}

export function resolveEventNode(book: Book, event: string): GraphNode | undefined {
  const nodes = book.findNodes("event");
  return nodes.find(
    (n) => n.label === event || n.id === event || String(n.properties.event ?? "") === event
  );
}

export function hasKnowledge(book: Book, actorId: string, fact: string): boolean {
  const knowledge = resolveKnowledge(book, fact);
  if (!knowledge) return false;
  const edges = book.store.findEdges({
    bookId: book.id,
    type: "knows",
    fromId: actorId,
    toId: knowledge.id,
  });
  return edges.length > 0;
}

export function hasFeeling(book: Book, actorId: string, emotion: string, toward?: string): boolean {
  const edges = book.store.findEdges({ bookId: book.id, type: "feels_toward", fromId: actorId });
  return edges.some((e) => {
    const edgeEmotion = String(e.properties.emotion ?? "").toLowerCase();
    if (edgeEmotion !== emotion.toLowerCase()) return false;
    if (!toward) return true;
    const target = book.store.getNode(book.id, e.toId);
    return target?.label === toward || target?.id === toward;
  });
}

export function isConditionSatisfied(
  book: Book,
  condition: CausalCondition,
  targetChapter: number
): boolean {
  switch (condition.kind) {
    case "chapter": {
      const chapter = resolveConditionChapter(book, "chapter", condition.targetId);
      return chapter !== undefined && targetChapter >= chapter;
    }
    case "event": {
      const eventChapter = resolveConditionChapter(book, "event", condition.targetId);
      return eventChapter !== undefined && targetChapter >= eventChapter;
    }
    case "knows": {
      const actor = resolveCharacter(book, condition.actor);
      return actor ? hasKnowledge(book, actor.id, condition.fact) : false;
    }
    case "feels": {
      const actor = resolveCharacter(book, condition.actor);
      return actor ? hasFeeling(book, actor.id, condition.emotion, condition.toward) : false;
    }
    case "state":
      return false;
  }
}
