import { describe, it, expect } from "vitest";
import { parseConstraint } from "../parser.js";
import { ConstraintParseError } from "../types.js";

describe("parseConstraint", () => {
  it("parses forbid without condition", () => {
    const rule = parseConstraint("forbid 主角使用魔法");
    expect(rule).toEqual({ kind: "forbid", subject: "主角使用魔法", until: undefined });
  });

  it("parses forbid until chapter", () => {
    const rule = parseConstraint("forbid 主角使用魔法 until chapter-0004");
    expect(rule).toEqual({
      kind: "forbid",
      subject: "主角使用魔法",
      until: { targetType: "chapter", targetId: "chapter-0004" },
    });
  });

  it("parses forbid until event", () => {
    const rule = parseConstraint("forbid 泄露身份 until event 身份暴露");
    expect(rule).toEqual({
      kind: "forbid",
      subject: "泄露身份",
      until: { targetType: "event", targetId: "身份暴露" },
    });
  });

  it("parses require before chapter", () => {
    const rule = parseConstraint("require 主角获得圣剑 before chapter-0005");
    expect(rule).toEqual({
      kind: "require",
      event: "主角获得圣剑",
      before: { targetType: "chapter", targetId: "chapter-0005" },
    });
  });

  it("parses require before event", () => {
    const rule = parseConstraint("require 主角获得圣剑 before event 圣剑觉醒");
    expect(rule).toEqual({
      kind: "require",
      event: "主角获得圣剑",
      before: { targetType: "event", targetId: "圣剑觉醒" },
    });
  });

  it("is case-insensitive for keywords", () => {
    const rule = parseConstraint("FORBID 魔法 UNTIL CHAPTER chapter-0002");
    expect(rule.kind).toBe("forbid");
    expect((rule as { subject: string }).subject).toBe("魔法");
  });

  it("throws on empty forbid subject", () => {
    expect(() => parseConstraint("forbid")).toThrow(ConstraintParseError);
  });

  it("throws on require without before", () => {
    expect(() => parseConstraint("require 某事发生")).toThrow(ConstraintParseError);
  });

  it("throws on unknown target type", () => {
    expect(() => parseConstraint("forbid X until scene-0001")).toThrow(ConstraintParseError);
  });
});
