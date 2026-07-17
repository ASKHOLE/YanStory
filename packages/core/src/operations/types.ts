import type { Book } from "../models/book.js";
import type { GraphNode } from "../graph/types.js";
import type { Violation } from "../constraints/types.js";

export interface ComposeOptions {
  intent: string;
  targetWords?: number;
  target?: string;
  /** Skip causal/constraint pre-checks. Defaults to false. */
  skipConstraints?: boolean;
}

export interface EditOptions {
  target: string;
  operation: string;
  instruction?: string;
  /** Skip causal/constraint pre-checks. Defaults to false. */
  skipConstraints?: boolean;
}

export interface ComposeResult {
  node: GraphNode;
  contentPath: string;
  wordCount: number;
}

export interface EditResult {
  node: GraphNode;
  contentPath: string;
}

export interface QueryOptions {
  type: string;
  filters?: Record<string, string | string[] | undefined>;
}

export interface QueryResult {
  items: GraphNode[];
}

export interface PatchProposal {
  id: string;
  description: string;
  operations: PatchOperation[];
}

export interface PatchOperation {
  op: "create" | "update" | "delete";
  path: string;
  nodeType?: string;
  properties?: Record<string, unknown>;
  content?: string;
}

export interface ApplyPatchResult {
  applied: number;
}

export interface OperationContext {
  book: Book;
  agentId?: string;
}

export type { Violation as ConstraintViolation };
