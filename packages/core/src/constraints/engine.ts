import type { Book } from "../models/book.js";
import { ConstraintError, type ConstraintContext, type ConstraintRule, type Violation, type CausalCondition } from "./types.js";
import { isConditionSatisfied } from "./causal.js";

export function checkConstraints(book: Book, context: ConstraintContext): Violation[] {
  const constraints = book.store.findNodes({ bookId: book.id, type: "constraint" });
  const violations: Violation[] = [];

  for (const node of constraints) {
    const dsl = String(node.properties.dsl ?? "");
    if (!dsl) continue;

    const rule = node.properties.rule as ConstraintRule | undefined;
    if (!rule) continue;

    const violation = evaluateRule(book, node.id, dsl, rule, context);
    if (violation) violations.push(violation);
  }

  return violations;
}

export function assertConstraints(book: Book, context: ConstraintContext): void {
  const violations = checkConstraints(book, context);
  if (violations.length > 0) {
    throw new ConstraintError(violations);
  }
}

function evaluateRule(
  book: Book,
  constraintId: string,
  dsl: string,
  rule: ConstraintRule,
  context: ConstraintContext
): Violation | undefined {
  switch (rule.kind) {
    case "forbid":
      return evaluateForbid(book, constraintId, dsl, rule, context);
    case "require":
      return evaluateRequire(book, constraintId, dsl, rule, context);
    case "never":
      return evaluateNever(book, constraintId, dsl, rule, context);
    case "prevent":
      return evaluatePrevent(book, constraintId, dsl, rule, context);
    case "cannot":
      return evaluateCannot(book, constraintId, dsl, rule, context);
    default:
      return undefined;
  }
}

function evaluateForbid(
  book: Book,
  constraintId: string,
  dsl: string,
  rule: Extract<ConstraintRule, { kind: "forbid" }>,
  context: ConstraintContext
): Violation | undefined {
  const targetChapter = resolveTargetChapter(book, context.targetPath);
  if (targetChapter === undefined) return undefined;

  const conditionChapter = rule.until
    ? resolveConditionChapter(book, rule.until.targetType, rule.until.targetId)
    : undefined;

  // If condition is not found, treat it as never satisfied → always forbid.
  if (rule.until && conditionChapter === undefined) {
    if (textMentions(context.targetText, rule.subject)) {
      return {
        constraintId,
        dsl,
        message: `Forbid "${rule.subject}" violated at ${context.targetPath} (condition ${formatTarget(rule.until)} not found)`,
      };
    }
    return undefined;
  }

  // If condition chapter exists and target is at or after it, the forbid is lifted.
  if (conditionChapter !== undefined && targetChapter >= conditionChapter) {
    return undefined;
  }

  if (textMentions(context.targetText, rule.subject)) {
    return {
      constraintId,
      dsl,
      message: `Forbid "${rule.subject}" violated at ${context.targetPath} (must wait until ${formatTarget(rule.until)})`,
    };
  }

  return undefined;
}

function evaluateRequire(
  book: Book,
  constraintId: string,
  dsl: string,
  rule: Extract<ConstraintRule, { kind: "require" }>,
  context: ConstraintContext
): Violation | undefined {
  const targetChapter = resolveTargetChapter(book, context.targetPath);
  if (targetChapter === undefined) return undefined;

  const conditionChapter = resolveConditionChapter(
    book,
    rule.before.targetType,
    rule.before.targetId
  );
  if (conditionChapter === undefined) {
    return {
      constraintId,
      dsl,
      message: `Require "${rule.event}" before ${formatTarget(rule.before)} cannot be evaluated (target not found)`,
    };
  }

  // Only enforce when the write target is at or after the condition chapter.
  if (targetChapter < conditionChapter) return undefined;

  const eventExists = eventNodeExists(book, rule.event);
  if (eventExists) return undefined;

  return {
    constraintId,
    dsl,
    message: `Require "${rule.event}" before ${formatTarget(rule.before)} violated at ${context.targetPath}`,
  };
}

function resolveTargetChapter(book: Book, targetPath: string): number | undefined {
  const match = targetPath.match(/chapter-(\d+)/);
  if (match) return Number(match[1]);

  // Try to resolve via path to find a chapter node.
  const node = book.resolver.resolveSingle(book.id, targetPath);
  if (!node) return undefined;

  let current: typeof node | undefined = node;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.type === "chapter") {
      const num = Number(current.properties.chapterNumber ?? 0);
      return Number.isNaN(num) ? undefined : num;
    }
    const parents = book.store.findEdges({ bookId: book.id, toId: current.id, type: "contains" });
    current = parents.length > 0 ? book.store.getNode(book.id, parents[0].fromId) : undefined;
  }
  return undefined;
}

export function resolveConditionChapter(
  book: Book,
  targetType: "chapter" | "event",
  targetId: string
): number | undefined {
  if (targetType === "chapter") {
    const chapterId = targetId.startsWith("chapter-") ? targetId : `chapter-${targetId}`;
    const chapter = book.store.findNodes({ bookId: book.id, type: "chapter", label: chapterId })[0];
    if (chapter) {
      const num = Number(chapter.properties.chapterNumber ?? 0);
      return Number.isNaN(num) ? undefined : num;
    }
    // Fall back to parsing the id directly.
    const match = chapterId.match(/chapter-(\d+)/);
    if (match) return Number(match[1]);
    return undefined;
  }

  // Event target: map to the chapter in which the event first appears.
  const events = book.store
    .findNodes({ bookId: book.id, type: "event" })
    .filter((e) => e.label === targetId || e.id === targetId || String(e.properties.event ?? "") === targetId);
  if (events.length === 0) return undefined;

  const event = events[0];
  return resolveTargetChapter(book, event.id);
}

function eventNodeExists(book: Book, eventName: string): boolean {
  const nodes = book.store.findNodes({ bookId: book.id, type: "event" });
  return nodes.some(
    (n) =>
      n.label === eventName ||
      n.id === eventName ||
      String(n.properties.event ?? "") === eventName ||
      String(n.properties.description ?? "").includes(eventName)
  );
}

function textMentions(text: string, subject: string): boolean {
  return text.toLowerCase().includes(subject.toLowerCase());
}

function formatTarget(target?: { targetType: string; targetId: string }): string {
  if (!target) return "(always)";
  if (target.targetId.toLowerCase().startsWith(`${target.targetType}-`)) {
    return target.targetId;
  }
  return `${target.targetType} ${target.targetId}`;
}

function evaluateNever(
  book: Book,
  constraintId: string,
  dsl: string,
  rule: Extract<ConstraintRule, { kind: "never" }>,
  context: ConstraintContext
): Violation | undefined {
  if (textMentions(context.targetText, rule.subject)) {
    return {
      constraintId,
      dsl,
      message: `Never "${rule.subject}" violated at ${context.targetPath}`,
    };
  }
  return undefined;
}

function evaluatePrevent(
  book: Book,
  constraintId: string,
  dsl: string,
  rule: Extract<ConstraintRule, { kind: "prevent" }>,
  context: ConstraintContext
): Violation | undefined {
  if (!textMentions(context.targetText, rule.event)) return undefined;

  const targetChapter = resolveTargetChapter(book, context.targetPath);
  if (targetChapter === undefined) return undefined;

  if (isConditionSatisfied(book, rule.until, targetChapter)) return undefined;

  return {
    constraintId,
    dsl,
    message: `Prevent "${rule.event}" violated at ${context.targetPath} (must wait until ${formatCondition(rule.until)})`,
  };
}

function evaluateCannot(
  book: Book,
  constraintId: string,
  dsl: string,
  rule: Extract<ConstraintRule, { kind: "cannot" }>,
  context: ConstraintContext
): Violation | undefined {
  if (
    !textMentions(context.targetText, rule.actor) ||
    !textMentions(context.targetText, rule.action)
  ) {
    return undefined;
  }

  const targetChapter = resolveTargetChapter(book, context.targetPath);
  if (targetChapter === undefined) return undefined;

  if (isConditionSatisfied(book, rule.until, targetChapter)) return undefined;

  return {
    constraintId,
    dsl,
    message: `Cannot "${rule.actor}" do "${rule.action}" violated at ${context.targetPath} (must wait until ${formatCondition(rule.until)})`,
  };
}

function formatCondition(condition: CausalCondition): string {
  switch (condition.kind) {
    case "chapter":
      return `chapter ${condition.targetId}`;
    case "event":
      return `event ${condition.targetId}`;
    case "knows":
      return `${condition.actor} knows ${condition.fact}`;
    case "feels":
      return condition.toward
        ? `${condition.actor} feels ${condition.emotion} toward ${condition.toward}`
        : `${condition.actor} feels ${condition.emotion}`;
    case "state":
      return `state ${condition.description}`;
    default:
      return String((condition as { kind: string }).kind);
  }
}

function isCausalRule(rule: ConstraintRule): rule is
  | Extract<ConstraintRule, { kind: "never" }>
  | Extract<ConstraintRule, { kind: "prevent" }>
  | Extract<ConstraintRule, { kind: "cannot" }> {
  return rule.kind === "never" || rule.kind === "prevent" || rule.kind === "cannot";
}

export function precheckCausalConstraints(
  book: Book,
  context: Pick<ConstraintContext, "targetPath" | "intent">
): Violation[] {
  const constraints = book.store.findNodes({ bookId: book.id, type: "constraint" });
  const violations: Violation[] = [];
  const fullContext: ConstraintContext = {
    targetPath: context.targetPath,
    targetText: context.intent ?? "",
    intent: context.intent,
  };

  for (const node of constraints) {
    const dsl = String(node.properties.dsl ?? "");
    if (!dsl) continue;
    const rule = node.properties.rule as ConstraintRule | undefined;
    if (!rule) continue;
    if (!isCausalRule(rule)) continue;

    const violation = evaluateRule(book, node.id, dsl, rule, fullContext);
    if (violation) violations.push(violation);
  }

  return violations;
}

export function assertCausalConstraints(
  book: Book,
  context: Pick<ConstraintContext, "targetPath" | "intent">
): void {
  const violations = precheckCausalConstraints(book, context);
  if (violations.length > 0) {
    throw new ConstraintError(violations);
  }
}
