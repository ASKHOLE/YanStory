import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Book } from "../../index.js";
import {
  resolveCharacter,
  resolveKnowledge,
  hasKnowledge,
  hasFeeling,
  isConditionSatisfied,
} from "../causal.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-causal-test-"));
}

function createCharacter(book: Book, id: string, label: string) {
  const now = new Date().toISOString();
  book.store.createNode({
    id,
    bookId: book.id,
    type: "character",
    label,
    contentUri: null,
    properties: {},
    createdAt: now,
    updatedAt: now,
  });
}

function createKnowledge(book: Book, id: string, label: string) {
  const now = new Date().toISOString();
  book.store.createNode({
    id,
    bookId: book.id,
    type: "knowledge",
    label,
    contentUri: null,
    properties: {},
    createdAt: now,
    updatedAt: now,
  });
}

function createEdge(book: Book, type: string, fromId: string, toId: string) {
  book.store.createEdge({
    id: randomUUID(),
    bookId: book.id,
    type: type as import("../../graph/types.js").EdgeType,
    fromId,
    toId,
    properties: {},
    createdAt: new Date().toISOString(),
  });
}

describe("causal helpers", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Causal Novel", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("resolves character by label", () => {
    createCharacter(book, "char-1", "主角");
    expect(resolveCharacter(book, "主角")?.id).toBe("char-1");
    expect(resolveCharacter(book, "char-1")?.id).toBe("char-1");
    expect(resolveCharacter(book, "不存在")).toBeUndefined();
  });

  it("detects knowledge edge", () => {
    createCharacter(book, "char-1", "主角");
    createKnowledge(book, "know-1", "魔法存在");
    expect(hasKnowledge(book, "char-1", "魔法存在")).toBe(false);
    createEdge(book, "knows", "char-1", "know-1");
    expect(hasKnowledge(book, "char-1", "魔法存在")).toBe(true);
  });

  it("detects feeling edge with emotion property", () => {
    createCharacter(book, "char-1", "反派");
    createCharacter(book, "char-2", "国王");
    expect(hasFeeling(book, "char-1", "愤怒", "国王")).toBe(false);
    book.store.createEdge({
      id: randomUUID(),
      bookId: book.id,
      type: "feels_toward",
      fromId: "char-1",
      toId: "char-2",
      properties: { emotion: "愤怒" },
      createdAt: new Date().toISOString(),
    });
    expect(hasFeeling(book, "char-1", "愤怒", "国王")).toBe(true);
    expect(hasFeeling(book, "char-1", "悲伤", "国王")).toBe(false);
  });

  it("evaluates chapter condition by target chapter", () => {
    const now = new Date().toISOString();
    book.store.createNode({
      id: "chapter-0005",
      bookId: book.id,
      type: "chapter",
      label: "Chapter 5",
      contentUri: null,
      properties: { chapterNumber: 5 },
      createdAt: now,
      updatedAt: now,
    });
    expect(isConditionSatisfied(book, { kind: "chapter", targetId: "chapter-0005" }, 4)).toBe(false);
    expect(isConditionSatisfied(book, { kind: "chapter", targetId: "chapter-0005" }, 5)).toBe(true);
  });

  it("evaluates knowledge condition", () => {
    createCharacter(book, "char-1", "主角");
    createKnowledge(book, "know-1", "海上有风暴");
    const cond = { kind: "knows" as const, actor: "主角", fact: "海上有风暴" };
    expect(isConditionSatisfied(book, cond, 1)).toBe(false);
    createEdge(book, "knows", "char-1", "know-1");
    expect(isConditionSatisfied(book, cond, 1)).toBe(true);
  });

  it("treats state condition as unsatisfied", () => {
    expect(isConditionSatisfied(book, { kind: "state", description: "风暴来临" }, 99)).toBe(false);
  });
});
