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

  it("parses never rule", () => {
    const rule = parseConstraint("never 主角死亡");
    expect(rule).toEqual({ kind: "never", subject: "主角死亡" });
  });

  it("parses prevent until chapter", () => {
    const rule = parseConstraint("prevent 主角使用魔法 until chapter-0004");
    expect(rule).toEqual({
      kind: "prevent",
      event: "主角使用魔法",
      until: { kind: "chapter", targetId: "chapter-0004" },
    });
  });

  it("parses prevent until event", () => {
    const rule = parseConstraint("prevent 身份暴露 until event 真相揭露");
    expect(rule).toEqual({
      kind: "prevent",
      event: "身份暴露",
      until: { kind: "event", targetId: "真相揭露" },
    });
  });

  it("parses prevent until knowledge condition", () => {
    const rule = parseConstraint("prevent 主角出海 until 主角 knows 海上有风暴");
    expect(rule).toEqual({
      kind: "prevent",
      event: "主角出海",
      until: { kind: "knows", actor: "主角", fact: "海上有风暴" },
    });
  });

  it("parses cannot until knowledge", () => {
    const rule = parseConstraint("cannot 主角 使用魔法 until 主角 knows 魔法存在");
    expect(rule).toEqual({
      kind: "cannot",
      actor: "主角",
      action: "使用魔法",
      until: { kind: "knows", actor: "主角", fact: "魔法存在" },
    });
  });

  it("parses cannot until emotion with toward", () => {
    const rule = parseConstraint("cannot 反派 背叛 until 反派 feels 愤怒 toward 国王");
    expect(rule).toEqual({
      kind: "cannot",
      actor: "反派",
      action: "背叛",
      until: { kind: "feels", actor: "反派", emotion: "愤怒", toward: "国王" },
    });
  });

  it("parses cannot until emotion without toward", () => {
    const rule = parseConstraint("cannot 主角 绝望 until 主角 feels 绝望");
    expect(rule).toEqual({
      kind: "cannot",
      actor: "主角",
      action: "绝望",
      until: { kind: "feels", actor: "主角", emotion: "绝望" },
    });
  });

  it("falls back to state condition for unmodeled state", () => {
    const rule = parseConstraint("prevent 主角出海 until state 风暴来临");
    expect(rule).toEqual({
      kind: "prevent",
      event: "主角出海",
      until: { kind: "state", description: "风暴来临" },
    });
  });

  it("throws on prevent without until", () => {
    expect(() => parseConstraint("prevent 某事发生")).toThrow(ConstraintParseError);
  });

  it("throws on cannot without actor and action", () => {
    expect(() => parseConstraint("cannot 主角 until chapter-0002")).toThrow(ConstraintParseError);
  });
});
