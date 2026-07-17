import { ConstraintParseError, type ConstraintRule } from "./types.js";

export function parseConstraint(dsl: string): ConstraintRule {
  const normalized = dsl.trim();
  if (normalized.toLowerCase().startsWith("forbid ")) {
    return parseForbid(normalized);
  }
  if (normalized.toLowerCase().startsWith("require ")) {
    return parseRequire(normalized);
  }
  throw new ConstraintParseError(
    `Constraint must start with "forbid" or "require": ${normalized}`
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
