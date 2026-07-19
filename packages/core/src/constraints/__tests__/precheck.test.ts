import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, ConstraintError } from "../../index.js";
import { assertCausalConstraints } from "../engine.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-precheck-test-"));
}

describe("precheckCausalConstraints", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Precheck Novel", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("throws ConstraintError when intent violates never rule", () => {
    book.addConstraint("never 主角死亡");
    expect(() =>
      assertCausalConstraints(book, {
        targetPath: "chapter-0002/scene-1/paragraph-1",
        intent: "让主角死亡",
      })
    ).toThrow(ConstraintError);
  });

  it("throws ConstraintError when intent violates prevent until chapter", () => {
    book.addConstraint("prevent 主角使用魔法 until chapter-0004");
    expect(() =>
      assertCausalConstraints(book, {
        targetPath: "chapter-0002/scene-1/paragraph-1",
        intent: "主角使用魔法击败敌人",
      })
    ).toThrow(ConstraintError);
  });

  it("does not throw when condition chapter is at or before target chapter", () => {
    book.addConstraint("prevent 主角使用魔法 until chapter-0002");
    expect(() =>
      assertCausalConstraints(book, {
        targetPath: "chapter-0002/scene-1/paragraph-1",
        intent: "主角使用魔法",
      })
    ).not.toThrow();
  });

  it("ignores forbid/require rules during causal precheck", () => {
    book.addConstraint("forbid 魔法 until chapter-0004");
    expect(() =>
      assertCausalConstraints(book, {
        targetPath: "chapter-0001/scene-1/paragraph-1",
        intent: "主角施展魔法",
      })
    ).not.toThrow();
  });
});
