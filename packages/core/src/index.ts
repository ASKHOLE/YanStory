export { helloCore } from "./hello.js";
export { Book, type CreateBookOptions } from "./models/book.js";
export { GraphStore } from "./graph/store.js";
export type { GraphNode, GraphEdge, NodeType, EdgeType, Branch } from "./graph/types.js";
export { AddressResolver } from "./address/resolver.js";
export { parseAddressPath, formatAddressPath } from "./address/path.js";
export { createLLMClient, createLLMClientFromConfig, type LLMClient } from "./llm/client.js";
export { createLLMStub, LLMStub } from "./llm/stub.js";
export {
  loadSecrets,
  saveSecrets,
  resolveLLMConfig,
  resolveEmbeddingConfig,
  getDisplayConfig,
  setConfigValue,
} from "./project/config.js";
export type {
  LLMConfig,
  EmbeddingConfig,
  ResolvedLLMConfig,
  ResolvedEmbeddingConfig,
} from "./project/config.js";
export {
  ensureProjectLayout,
  getProjectPaths,
  getBookPaths,
  listBooks,
  bookExists,
} from "./project/layout.js";
export { exportBook, importBook } from "./project/book-io.js";
export {
  parseConstraint,
  checkConstraints,
  assertConstraints,
  buildConstraintTimeline,
  ConstraintError,
  ConstraintParseError,
} from "./constraints/index.js";
export type {
  Constraint,
  ConstraintContext,
  ConstraintRule,
  ForbidRule,
  RequireRule,
  Violation,
  ConstraintTimelineItem,
  ConstraintTimelineTarget,
  ForbidTimelineItem,
  RequireTimelineItem,
} from "./constraints/index.js";
export {
  HashEmbeddingProvider,
  createHashEmbeddingProvider,
  createEmbeddingProvider,
  EmbeddingStore,
} from "./embeddings/index.js";
export type {
  EmbeddingProvider,
  EmbedRecord,
  SimilarityQuery,
  SimilarityResult,
} from "./embeddings/index.js";
export { simulateReader } from "./operations/reader.js";
export { critique } from "./operations/critique.js";
export {
  addClue,
  listClues,
  resolveClue,
  buildClueTimeline,
} from "./operations/clue.js";
export { similarNodes } from "./memory/index.js";
export type { SimilarNodesOptions } from "./memory/index.js";
export type {
  ComposeOptions,
  ComposeResult,
  EditOptions,
  EditResult,
  QueryOptions,
  QueryResult,
  PatchProposal,
  PatchOperation,
  ApplyPatchResult,
  SimulateReaderOptions,
  SimulateReaderResult,
  ReaderScores,
  ReaderHighlight,
  CritiqueOptions,
  CritiqueResult,
  CritiqueScores,
  ClueStatus,
  AddClueOptions,
  ResolveClueOptions,
  ClueItem,
  ClueTimelineItem,
} from "./operations/types.js";
export {
  forkBranch,
  listBranches,
  getCurrentBranch,
  checkoutBranch,
  mergeBranches,
} from "./operations/branch.js";
export type { MergeProposal, MergeConflict } from "./operations/branch.js";
