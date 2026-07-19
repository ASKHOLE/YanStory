export type ConstraintRule = ForbidRule | RequireRule | NeverRule | PreventRule | CannotRule;

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

export interface NeverRule {
  kind: "never";
  subject: string;
}

export interface PreventRule {
  kind: "prevent";
  event: string;
  until: CausalCondition;
}

export interface CannotRule {
  kind: "cannot";
  actor: string;
  action: string;
  until: CausalCondition;
}

export type CausalCondition =
  | ChapterCondition
  | EventCondition
  | KnowledgeCondition
  | EmotionCondition
  | StateCondition;

export interface ChapterCondition {
  kind: "chapter";
  targetId: string;
}

export interface EventCondition {
  kind: "event";
  targetId: string;
}

export interface KnowledgeCondition {
  kind: "knows";
  actor: string;
  fact: string;
}

export interface EmotionCondition {
  kind: "feels";
  actor: string;
  emotion: string;
  toward?: string;
}

export interface StateCondition {
  kind: "state";
  description: string;
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

export interface ConstraintTimelineTarget {
  type: "chapter" | "event";
  id: string;
  label: string;
  /** Resolved chapter number for positioning on the axis. */
  chapterNumber: number | null;
}

export interface ConstraintTimelineItemBase {
  id: string;
  dsl: string;
  target?: ConstraintTimelineTarget;
  /** First chapter where the constraint is active; null for point constraints. */
  startChapterNumber: number | null;
  /** Last chapter the constraint applies to; null for open-ended forbid rules. */
  endChapterNumber: number | null;
}

export interface ForbidTimelineItem extends ConstraintTimelineItemBase {
  kind: "forbid";
  subject: string;
}

export interface RequireTimelineItem extends ConstraintTimelineItemBase {
  kind: "require";
  event: string;
}

export interface NeverTimelineItem extends ConstraintTimelineItemBase {
  kind: "never";
  subject: string;
}

export interface PreventTimelineItem extends ConstraintTimelineItemBase {
  kind: "prevent";
  event: string;
}

export interface CannotTimelineItem extends ConstraintTimelineItemBase {
  kind: "cannot";
  actor: string;
  action: string;
}

export type ConstraintTimelineItem =
  | ForbidTimelineItem
  | RequireTimelineItem
  | NeverTimelineItem
  | PreventTimelineItem
  | CannotTimelineItem;

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
