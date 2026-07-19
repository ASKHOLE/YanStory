import type { Book } from "../models/book.js";
import type { GraphNode } from "../graph/types.js";
import type { Violation } from "../constraints/types.js";

export interface ComposeOptions {
  intent: string;
  targetWords?: number;
  target?: string;
  /** Skip post-generation constraint checks. Defaults to false. */
  skipConstraints?: boolean;
  /** Skip causal pre-check before LLM call. Defaults to false. */
  skipCausalPrecheck?: boolean;
}

export interface EditOptions {
  target: string;
  operation: string;
  instruction?: string;
  /** Skip post-generation constraint checks. Defaults to false. */
  skipConstraints?: boolean;
  /** Skip causal pre-check before LLM call. Defaults to false. */
  skipCausalPrecheck?: boolean;
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

export interface ReaderHighlight {
  type: "confusing" | "engaging" | "boring" | "inconsistent" | "memorable";
  quote?: string;
  reason: string;
}

export interface ReaderScores {
  comprehension: number;
  engagement: number;
  consistency: number;
  suspense: number;
}

export interface SimulateReaderOptions {
  target?: string;
  perspective?: string;
  focus?: string[];
}

export interface SimulateReaderResult {
  summary: string;
  scores: ReaderScores;
  highlights: ReaderHighlight[];
  questions: string[];
  predictions: string[];
}

export interface CritiqueScores {
  pacing: number;
  character: number;
  worldbuilding: number;
  dialogue: number;
  originality: number;
}

export interface CritiqueOptions {
  target?: string;
  role?: string;
  focus?: string[];
}

export interface CritiqueResult {
  summary: string;
  verdict: "pass" | "revise" | "major-revision";
  scores: CritiqueScores;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  genreNotes: string[];
}

export type ClueStatus = "planted" | "resolved";

export interface AddClueOptions {
  label: string;
  description?: string;
  plantAt: string;
  resolveAt?: string;
  targetId?: string;
  order?: number;
}

export interface ResolveClueOptions {
  clueId: string;
  resolveAt: string;
}

export interface ClueItem {
  id: string;
  label: string;
  description: string;
  status: ClueStatus;
  plantAt: string;
  resolveAt: string | null;
  targetId: string | null;
  order: number;
  createdAt: string;
}

export interface ClueTimelineItem extends ClueItem {
  plantLabel: string;
  resolveLabel?: string;
  targetLabel?: string;
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
