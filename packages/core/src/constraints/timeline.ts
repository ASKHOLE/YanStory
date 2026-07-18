import type { Book } from "../models/book.js";
import type { ConstraintRule, ConstraintTimelineItem, ConstraintTimelineTarget } from "./types.js";
import type { GraphNode } from "../graph/types.js";
import { resolveConditionChapter } from "./engine.js";

function getSortedChapters(book: Book): GraphNode[] {
  return book
    .findNodes("chapter")
    .slice()
    .sort((a, b) => Number(a.properties.chapterNumber ?? 0) - Number(b.properties.chapterNumber ?? 0));
}

function resolveTarget(
  book: Book,
  targetType: "chapter" | "event",
  targetId: string
): ConstraintTimelineTarget | undefined {
  const chapterNumber = resolveConditionChapter(book, targetType, targetId);
  if (chapterNumber === undefined) return undefined;

  if (targetType === "chapter") {
    const id = targetId.startsWith("chapter-") ? targetId : `chapter-${targetId}`;
    const node = book.store.getNode(book.id, id);
    if (!node) return undefined;
    return { type: "chapter", id, label: node.label, chapterNumber };
  }

  const node = book.store.getNode(book.id, targetId);
  if (node) {
    return { type: "event", id: targetId, label: node.label, chapterNumber };
  }

  const events = book.store.findNodes({ bookId: book.id, type: "event" }).filter((e) => e.label === targetId);
  if (events.length > 0) {
    return { type: "event", id: events[0].id, label: events[0].label, chapterNumber };
  }

  return { type: "event", id: targetId, label: targetId, chapterNumber };
}

export function buildConstraintTimeline(book: Book): ConstraintTimelineItem[] {
  const chapters = getSortedChapters(book);
  const firstChapterNumber = chapters.length > 0 ? Number(chapters[0].properties.chapterNumber ?? 1) : 1;
  const constraints = book.listConstraints();

  return constraints.map((node) => {
    const dsl = String(node.properties.dsl ?? "");
    const rule = node.properties.rule as ConstraintRule;
    const base = { id: node.id, dsl };

    switch (rule.kind) {
      case "forbid": {
        const target = rule.until ? resolveTarget(book, rule.until.targetType, rule.until.targetId) : undefined;
        return {
          ...base,
          kind: "forbid" as const,
          subject: rule.subject,
          target,
          startChapterNumber: firstChapterNumber,
          endChapterNumber: target?.chapterNumber ?? null,
        };
      }
      case "require": {
        const target = resolveTarget(book, rule.before.targetType, rule.before.targetId);
        return {
          ...base,
          kind: "require" as const,
          event: rule.event,
          target,
          startChapterNumber: null,
          endChapterNumber: target?.chapterNumber ?? null,
        };
      }
      default:
        return {
          ...base,
          kind: "forbid" as const,
          subject: dsl,
          startChapterNumber: firstChapterNumber,
          endChapterNumber: null,
        };
    }
  });
}
