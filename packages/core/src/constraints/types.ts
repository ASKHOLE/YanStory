export type ConstraintRule = ForbidRule | RequireRule;

export interface ForbidRule {
  kind: "forbid";
  subject: string;
  until?: {
    targetType: "chapter" | "event";
    targetId: string;
  };
}

export interface RequireRule {
  kind: "require";
  event: string;
  before: {
    targetType: "chapter" | "event";
    targetId: string;
  };
}

export interface Constraint {
  id: string;
  dsl: string;
  rule: ConstraintRule;
}

export interface ConstraintContext {
  /** Addressable path of the node being written (e.g. chapter-0003/scene-1/paragraph-2). */
  targetPath: string;
  /** Text that is about to be written. */
  targetText: string;
  /** Operation intent, if available. */
  intent?: string;
}

export interface Violation {
  constraintId: string;
  dsl: string;
  message: string;
}

export class ConstraintParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConstraintParseError";
  }
}

export class ConstraintError extends Error {
  violations: Violation[];

  constructor(violations: Violation[]) {
    const messages = violations.map((v) => v.message).join("; ");
    super(`Constraint violations detected: ${messages}`);
    this.name = "ConstraintError";
    this.violations = violations;
  }
}
