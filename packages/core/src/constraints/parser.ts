import { ConstraintParseError, type ConstraintRule, type CausalCondition } from "./types.js";

export function parseConstraint(dsl: string): ConstraintRule {
  const normalized = dsl.trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith("forbid ")) {
    return parseForbid(normalized);
  }
  if (lower.startsWith("require ")) {
    return parseRequire(normalized);
  }
  if (lower.startsWith("never ")) {
    return parseNever(normalized);
  }
  if (lower.startsWith("prevent ")) {
    return parsePrevent(normalized);
  }
  if (lower.startsWith("cannot ")) {
    return parseCannot(normalized);
  }
  throw new ConstraintParseError(
    `Constraint must start with "forbid", "require", "never", "prevent" or "cannot": ${normalized}`
  );
}

function parseForbid(dsl: string): ConstraintRule {
  // forbid <subject> [until <target>]
  const untilIndex = dsl.toLowerCase().indexOf(" until ");
  let subject: string;
  let until: { targetType: "chapter" | "event"; targetId: string } | undefined;

  if (untilIndex === -1) {
    subject = dsl.slice(7).trim();
  } else {
    subject = dsl.slice(7, untilIndex).trim();
    const targetPart = dsl.slice(untilIndex + 7).trim();
    until = parseTarget(targetPart);
  }

  if (!subject) {
    throw new ConstraintParseError(`"forbid" requires a subject: ${dsl}`);
  }

  return { kind: "forbid", subject, until };
}

function parseRequire(dsl: string): ConstraintRule {
  // require <event> before <target>
  const beforeIndex = dsl.toLowerCase().indexOf(" before ");
  if (beforeIndex === -1) {
    throw new ConstraintParseError(`"require" must include "before": ${dsl}`);
  }

  const event = dsl.slice(8, beforeIndex).trim();
  const targetPart = dsl.slice(beforeIndex + 8).trim();

  if (!event) {
    throw new ConstraintParseError(`"require" requires an event: ${dsl}`);
  }

  const before = parseTarget(targetPart);
  return { kind: "require", event, before };
}

function parseTarget(part: string): { targetType: "chapter" | "event"; targetId: string } {
  const lower = part.toLowerCase();
  if (lower.startsWith("chapter ")) {
    return { targetType: "chapter", targetId: part.slice(8).trim() };
  }
  if (lower.startsWith("chapter-")) {
    return { targetType: "chapter", targetId: part };
  }
  if (lower.startsWith("event ")) {
    return { targetType: "event", targetId: part.slice(6).trim() };
  }
  if (lower.startsWith("event-")) {
    return { targetType: "event", targetId: part };
  }
  throw new ConstraintParseError(
    `Expected target to be "chapter <id>" or "event <id>", got: ${part}`
  );
}

function parseNever(dsl: string): ConstraintRule {
  const subject = dsl.slice(6).trim();
  if (!subject) {
    throw new ConstraintParseError(`"never" requires a subject: ${dsl}`);
  }
  return { kind: "never", subject };
}

function parsePrevent(dsl: string): ConstraintRule {
  const untilIndex = dsl.toLowerCase().indexOf(" until ");
  if (untilIndex === -1) {
    throw new ConstraintParseError(`"prevent" must include "until": ${dsl}`);
  }
  const event = dsl.slice(8, untilIndex).trim();
  const conditionPart = dsl.slice(untilIndex + 7).trim();
  if (!event) {
    throw new ConstraintParseError(`"prevent" requires an event: ${dsl}`);
  }
  return { kind: "prevent", event, until: parseCondition(conditionPart) };
}

function parseCannot(dsl: string): ConstraintRule {
  const untilIndex = dsl.toLowerCase().indexOf(" until ");
  if (untilIndex === -1) {
    throw new ConstraintParseError(`"cannot" must include "until": ${dsl}`);
  }
  const actorAndAction = dsl.slice(7, untilIndex).trim();
  const firstSpace = actorAndAction.indexOf(" ");
  if (firstSpace === -1) {
    throw new ConstraintParseError(`"cannot" requires both actor and action: ${dsl}`);
  }
  const actor = actorAndAction.slice(0, firstSpace).trim();
  const action = actorAndAction.slice(firstSpace + 1).trim();
  if (!actor || !action) {
    throw new ConstraintParseError(`"cannot" requires both actor and action: ${dsl}`);
  }
  const conditionPart = dsl.slice(untilIndex + 7).trim();
  return { kind: "cannot", actor, action, until: parseCondition(conditionPart) };
}

function parseCondition(part: string): CausalCondition {
  const lower = part.toLowerCase();
  if (lower.startsWith("chapter ")) {
    return { kind: "chapter", targetId: part.slice(8).trim() };
  }
  if (lower.startsWith("chapter-")) {
    return { kind: "chapter", targetId: part };
  }
  if (lower.startsWith("event ")) {
    return { kind: "event", targetId: part.slice(6).trim() };
  }
  if (lower.startsWith("event-")) {
    return { kind: "event", targetId: part };
  }
  if (lower.startsWith("state ")) {
    return { kind: "state", description: part.slice(6).trim() };
  }
  const knowsIndex = lower.indexOf(" knows ");
  if (knowsIndex !== -1) {
    return {
      kind: "knows",
      actor: part.slice(0, knowsIndex).trim(),
      fact: part.slice(knowsIndex + 7).trim(),
    };
  }
  const feelsIndex = lower.indexOf(" feels ");
  if (feelsIndex !== -1) {
    const actor = part.slice(0, feelsIndex).trim();
    const rest = part.slice(feelsIndex + 7).trim();
    const towardIndex = rest.toLowerCase().indexOf(" toward ");
    if (towardIndex !== -1) {
      return {
        kind: "feels",
        actor,
        emotion: rest.slice(0, towardIndex).trim(),
        toward: rest.slice(towardIndex + 8).trim(),
      };
    }
    return { kind: "feels", actor, emotion: rest };
  }
  return { kind: "state", description: part };
}
