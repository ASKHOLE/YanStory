import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book } from "../../index.js";
import { buildConstraintTimeline } from "../timeline.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-constraint-timeline-test-"));
}

function createChapter(book: Book, id: string, label: string, chapterNumber: number) {
  const now = new Date().toISOString();
  book.store.createNode({
    id,
    bookId: book.id,
    type: "chapter",
    label,
    contentUri: null,
    properties: { chapterNumber },
    createdAt: now,
    updatedAt: now,
  });
}

function createEvent(book: Book, id: string, label: string, chapterId: string) {
  const now = new Date().toISOString();
  book.store.createNode({
    id,
    bookId: book.id,
    type: "event",
    label,
    contentUri: null,
    properties: {},
    createdAt: now,
    updatedAt: now,
  });
  book.store.createEdge({
    id: `edge-${id}`,
    bookId: book.id,
    type: "contains",
    fromId: chapterId,
    toId: id,
    properties: {},
    createdAt: now,
  });
}

describe("buildConstraintTimeline", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Timeline Novel", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("builds forbid timeline until a chapter", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    createChapter(book, "chapter-0004", "Reveal", 4);
    const constraint = book.addConstraint("forbid 主角使用魔法 until chapter-0004");

    const timeline = buildConstraintTimeline(book);

    expect(timeline).toHaveLength(1);
    const item = timeline[0];
    expect(item.id).toBe(constraint.id);
    expect(item.kind).toBe("forbid");
    expect((item as { subject: string }).subject).toBe("主角使用魔法");
    expect(item.target).toEqual({
      type: "chapter",
      id: "chapter-0004",
      label: "Reveal",
      chapterNumber: 4,
    });
    expect(item.startChapterNumber).toBe(1);
    expect(item.endChapterNumber).toBe(4);
  });

  it("builds require timeline before an event", () => {
    createChapter(book, "chapter-0002", "Training", 2);
    createChapter(book, "chapter-0005", "Battle", 5);
    createEvent(book, "event-awaken", "Awakening", "chapter-0005");
    const constraint = book.addConstraint("require 主角觉醒 before event event-awaken");

    const timeline = buildConstraintTimeline(book);

    expect(timeline).toHaveLength(1);
    const item = timeline[0];
    expect(item.kind).toBe("require");
    expect((item as { event: string }).event).toBe("主角觉醒");
    expect(item.target).toEqual({
      type: "event",
      id: "event-awaken",
      label: "Awakening",
      chapterNumber: 5,
    });
    expect(item.startChapterNumber).toBeNull();
    expect(item.endChapterNumber).toBe(5);
  });

  it("returns always forbid with no end chapter", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    book.addConstraint("forbid 泄露身份");

    const timeline = buildConstraintTimeline(book);

    expect(timeline[0].endChapterNumber).toBeNull();
    expect(timeline[0].target).toBeUndefined();
  });

  it("handles missing target chapter by using id as label", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    book.addConstraint("forbid 魔法 until chapter-9999");

    const timeline = buildConstraintTimeline(book);

    expect(timeline[0].target).toEqual({
      type: "chapter",
      id: "chapter-9999",
      label: "chapter-9999",
      chapterNumber: 9999,
    });
    expect(timeline[0].endChapterNumber).toBe(9999);
  });

  it("builds never timeline as open-ended bar", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    book.addConstraint("never 主角死亡");
    const timeline = buildConstraintTimeline(book);
    expect(timeline[0]).toMatchObject({
      kind: "never",
      subject: "主角死亡",
      startChapterNumber: 1,
      endChapterNumber: null,
    });
  });

  it("builds prevent timeline until chapter", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    createChapter(book, "chapter-0004", "Reveal", 4);
    book.addConstraint("prevent 主角使用魔法 until chapter-0004");
    const timeline = buildConstraintTimeline(book);
    expect(timeline[0]).toMatchObject({
      kind: "prevent",
      event: "主角使用魔法",
      endChapterNumber: 4,
    });
  });

  it("builds cannot timeline until event", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    createChapter(book, "chapter-0003", "Training", 3);
    createEvent(book, "event-awaken", "Awakening", "chapter-0003");
    book.addConstraint("cannot 主角 使用魔法 until event event-awaken");
    const timeline = buildConstraintTimeline(book);
    expect(timeline[0]).toMatchObject({
      kind: "cannot",
      actor: "主角",
      action: "使用魔法",
      endChapterNumber: 3,
    });
  });

  it("leaves state condition without timeline target", () => {
    createChapter(book, "chapter-0001", "Opening", 1);
    book.addConstraint("prevent 主角出海 until state 风暴来临");
    const timeline = buildConstraintTimeline(book);
    expect(timeline[0].target).toBeUndefined();
    expect(timeline[0].endChapterNumber).toBeNull();
  });
});
