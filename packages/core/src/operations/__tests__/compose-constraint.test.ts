import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book, LLMStub, ConstraintError } from "../../index.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-compose-constraint-test-"));
}

describe("compose with constraints", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Constraint Compose", genre: "xuanhuan" });
    const stub = new LLMStub();
    stub.when(/.*魔法.*/, "主角施展了强大的魔法。");
    stub.when(/.*/, "普通的一天，没有异常。");
    book.setLLMClient((options) => stub.call(options));
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("throws ConstraintError when compose violates forbid rule", async () => {
    book.addConstraint("forbid 魔法 until chapter-0004");
    await expect(book.compose({ intent: "主角施展魔法", targetWords: 50 })).rejects.toThrow(
      ConstraintError
    );
  });

  it("does not throw when skipConstraints is true", async () => {
    book.addConstraint("forbid 魔法 until chapter-0004");
    const result = await book.compose({
      intent: "主角施展魔法",
      targetWords: 50,
      skipConstraints: true,
    });
    expect(result.node).toBeDefined();
  });

  it("succeeds when no constraints are set", async () => {
    const result = await book.compose({ intent: "普通场景", targetWords: 50 });
    expect(result.node).toBeDefined();
  });

  it("throws ConstraintError before LLM when causal precheck fails", async () => {
    book.addConstraint("never 主角死亡");
    await expect(book.compose({ intent: "主角死亡", targetWords: 50 })).rejects.toThrow(
      ConstraintError
    );
  });

  it("does not throw when skipCausalPrecheck is true", async () => {
    book.addConstraint("never 主角死亡");
    const result = await book.compose({
      intent: "主角死亡",
      targetWords: 50,
      skipCausalPrecheck: true,
    });
    expect(result.node).toBeDefined();
  });
});
