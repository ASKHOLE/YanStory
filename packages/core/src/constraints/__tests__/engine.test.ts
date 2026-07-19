import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, LLMStub } from "../../index.js";
import { checkConstraints } from "../engine.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-constraint-engine-test-"));
}

describe("constraint engine", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Constraint Novel", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/.*/, "Line one.\n\nLine two.");
    book.setLLMClient((options) => stub.call(options));
    await book.compose({ intent: "intro", targetWords: 50 });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("reports forbid violation when subject appears before condition chapter", () => {
    book.addConstraint("forbid 魔法 until chapter-0004");
    const violations = checkConstraints(book, {
      targetPath: "chapter-0001/scene-1/paragraph-1",
      targetText: "主角施展了魔法。",
    });
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain("Forbid \"魔法\" violated");
  });

  it("does not report forbid violation after condition chapter", async () => {
    book.addConstraint("forbid 魔法 until chapter-0002");
    // Compose created chapter-0001. Compose another to create chapter-0002.
    await book.compose({ intent: "middle", targetWords: 50 });
    const violations = checkConstraints(book, {
      targetPath: "chapter-0002/scene-1/paragraph-1",
      targetText: "主角施展了魔法。",
    });
    expect(violations.length).toBe(0);
  });

  it("reports require violation when event is missing before target chapter", () => {
    book.addConstraint("require 主角获得圣剑 before chapter-0005");
    const violations = checkConstraints(book, {
      targetPath: "chapter-0005/scene-1/paragraph-1",
      targetText: "主角挥舞着圣剑。",
    });
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain("Require \"主角获得圣剑\" before chapter-0005 violated");
  });

  it("does not report require violation when event exists", () => {
    book.addConstraint("require 主角获得圣剑 before chapter-0005");
    book.store.createNode({
      id: "event-1",
      bookId: book.id,
      type: "event",
      label: "主角获得圣剑",
      contentUri: null,
      properties: { event: "主角获得圣剑" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const violations = checkConstraints(book, {
      targetPath: "chapter-0003/scene-1/paragraph-1",
      targetText: "主角挥舞着圣剑。",
    });
    expect(violations.length).toBe(0);
  });

  it("does not report require violation before target chapter", () => {
    book.addConstraint("require 主角获得圣剑 before chapter-0005");
    const violations = checkConstraints(book, {
      targetPath: "chapter-0001/scene-1/paragraph-1",
      targetText: "主角还没有圣剑。",
    });
    expect(violations.length).toBe(0);
  });

  it("reports never violation when subject appears", () => {
    book.addConstraint("never 主角死亡");
    const violations = checkConstraints(book, {
      targetPath: "chapter-0001/scene-1/paragraph-1",
      targetText: "主角死亡了。",
    });
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain('Never "主角死亡" violated');
  });

  it("reports prevent violation when event appears before condition chapter", () => {
    book.addConstraint("prevent 主角使用魔法 until chapter-0004");
    const violations = checkConstraints(book, {
      targetPath: "chapter-0001/scene-1/paragraph-1",
      targetText: "主角使用魔法。",
    });
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain('Prevent "主角使用魔法" violated');
  });

  it("does not report prevent violation after condition chapter", async () => {
    book.addConstraint("prevent 主角使用魔法 until chapter-0002");
    await book.compose({ intent: "middle", targetWords: 50 });
    const violations = checkConstraints(book, {
      targetPath: "chapter-0002/scene-1/paragraph-1",
      targetText: "主角使用了魔法。",
    });
    expect(violations.length).toBe(0);
  });

  it("reports cannot violation when actor and action appear without knowledge", () => {
    book.addConstraint("cannot 主角 使用魔法 until 主角 knows 魔法存在");
    const violations = checkConstraints(book, {
      targetPath: "chapter-0001/scene-1/paragraph-1",
      targetText: "主角使用魔法。",
    });
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain('Cannot "主角" do "使用魔法" violated');
  });

  it("does not report cannot violation when knowledge condition is satisfied", () => {
    book.addConstraint("cannot 主角 使用魔法 until 主角 knows 魔法存在");
    const now = new Date().toISOString();
    book.store.createNode({
      id: "char-1",
      bookId: book.id,
      type: "character",
      label: "主角",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    book.store.createNode({
      id: "know-1",
      bookId: book.id,
      type: "knowledge",
      label: "魔法存在",
      contentUri: null,
      properties: {},
      createdAt: now,
      updatedAt: now,
    });
    book.store.createEdge({
      id: "edge-knows-1",
      bookId: book.id,
      type: "knows",
      fromId: "char-1",
      toId: "know-1",
      properties: {},
      createdAt: now,
    });
    const violations = checkConstraints(book, {
      targetPath: "chapter-0001/scene-1/paragraph-1",
      targetText: "主角使用了魔法。",
    });
    expect(violations.length).toBe(0);
  });
});
