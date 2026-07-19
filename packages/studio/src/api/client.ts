import type { PatchProposal, ApplyPatchResult, SimulateReaderOptions, SimulateReaderResult, CritiqueOptions, CritiqueResult, ClueItem, ClueTimelineItem, Branch, MergeProposal } from "@yanstory/core";

export type { PatchProposal, ApplyPatchResult, SimulateReaderOptions, SimulateReaderResult, CritiqueOptions, CritiqueResult, ClueItem, ClueTimelineItem, Branch, MergeProposal } from "@yanstory/core";

const API_BASE = "/api";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(`API error ${status}: ${JSON.stringify(data)}`);
    this.status = status;
    this.data = data;
  }
}

export interface BookInfo {
  id: string;
  title: string;
  genre: string;
  author: string;
  chapters: number;
  scenes: number;
  paragraphs: number;
  snapshots: number;
  constraints: number;
}

export interface BookListing {
  id: string;
  title: string;
  genre: string;
  createdAt: string;
}

export interface ConstraintItem {
  id: string;
  dsl: string;
}

export interface ConstraintTimelineTarget {
  type: "chapter" | "event";
  id: string;
  label: string;
  chapterNumber: number | null;
}

export type ConstraintTimelineItem =
  | {
      id: string;
      dsl: string;
      kind: "forbid";
      subject: string;
      target?: ConstraintTimelineTarget;
      startChapterNumber: number | null;
      endChapterNumber: number | null;
    }
  | {
      id: string;
      dsl: string;
      kind: "require";
      event: string;
      target?: ConstraintTimelineTarget;
      startChapterNumber: number | null;
      endChapterNumber: number | null;
    }
  | {
      id: string;
      dsl: string;
      kind: "never";
      subject: string;
      target?: ConstraintTimelineTarget;
      startChapterNumber: number | null;
      endChapterNumber: number | null;
    }
  | {
      id: string;
      dsl: string;
      kind: "prevent";
      event: string;
      target?: ConstraintTimelineTarget;
      startChapterNumber: number | null;
      endChapterNumber: number | null;
    }
  | {
      id: string;
      dsl: string;
      kind: "cannot";
      actor: string;
      action: string;
      target?: ConstraintTimelineTarget;
      startChapterNumber: number | null;
      endChapterNumber: number | null;
    };

export interface ConstraintViolation {
  constraintId: string;
  dsl: string;
  message: string;
}

export interface SearchResult {
  nodeId: string;
  type: string;
  label: string;
  score: number;
}

export interface CharacterItem {
  id: string;
  label: string;
  appearsIn: Array<{ sceneId: string; chapterId?: string; chapterNumber: number }>;
}

export interface EventItem {
  id: string;
  label: string;
  when: string | null;
  order: number;
}

export interface RelationshipNode {
  id: string;
  label: string;
  type: string;
}

export interface RelationshipLink {
  source: string;
  target: string;
  strength: number;
  scenes: string[];
}

export interface EmbeddingConfigInfo {
  provider: "fastembed" | "hash";
  model: string;
  dimension: number;
  cacheDir?: string;
}

export const api = {
  health: () => fetchJson<{ ok: boolean }>("/health"),

  listBooks: () => fetchJson<{ books: BookListing[] }>("/books"),

  createBook: (title: string, genre: string) =>
    fetchJson<BookListing>("/books", {
      method: "POST",
      body: JSON.stringify({ title, genre }),
    }),

  openBook: (id: string) =>
    fetchJson<BookInfo>(`/books/${id}/open`, { method: "POST" }),

  getBookInfo: (id: string) => fetchJson<BookInfo>(`/books/${id}/info`),

  compose: (id: string, intent: string, targetWords?: number, skipConstraints?: boolean, skipCausalPrecheck?: boolean) =>
    fetchJson<{ nodeId: string; contentPath: string; wordCount: number }>(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent, targetWords, skipConstraints, skipCausalPrecheck }),
    }),

  edit: (id: string, target: string, operation: string, instruction?: string, skipConstraints?: boolean, skipCausalPrecheck?: boolean) =>
    fetchJson<{ nodeId: string; contentPath: string }>(`/books/${id}/edit`, {
      method: "POST",
      body: JSON.stringify({ target, operation, instruction, skipConstraints, skipCausalPrecheck }),
    }),

  query: (id: string, type: string, filters?: Record<string, string | string[] | undefined>) =>
    fetchJson<{ items: unknown[] }>(`/books/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ type, filters }),
    }),

  projection: (id: string, target?: string) =>
    fetchJson<{ markdown: string; target?: string }>(`/books/${id}/projection${target ? `/${target}` : ""}`),

  listConstraints: (id: string) => fetchJson<{ constraints: ConstraintItem[] }>(`/books/${id}/constraints`),

  listConstraintTimeline: (id: string) =>
    fetchJson<{ timeline: ConstraintTimelineItem[] }>(`/books/${id}/constraints/timeline`),

  precheckConstraints: (id: string, targetPath: string, intent: string) =>
    fetchJson<{ violations: ConstraintViolation[] }>(`/books/${id}/constraints/precheck`, {
      method: "POST",
      body: JSON.stringify({ targetPath, intent }),
    }),

  addConstraint: (id: string, dsl: string) =>
    fetchJson<ConstraintItem>(`/books/${id}/constraints`, {
      method: "POST",
      body: JSON.stringify({ dsl }),
    }),

  removeConstraint: (id: string, constraintId: string) =>
    fetchJson<{ ok: boolean }>(`/books/${id}/constraints/${constraintId}`, { method: "DELETE" }),

  listSnapshots: (id: string) => fetchJson<{ snapshots: { id: string; name: string; createdAt: string }[] }>(`/books/${id}/snapshots`),

  createSnapshot: (id: string, name: string) =>
    fetchJson<{ id: string }>(`/books/${id}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  restoreSnapshot: (id: string, snapshotId: string) =>
    fetchJson<{ ok: boolean }>(`/books/${id}/snapshots/${snapshotId}/restore`, {
      method: "POST",
    }),

  listChapters: (id: string) =>
    fetchJson<{ chapters: Array<{ id: string; label: string; chapterNumber: number; contentUri: string }> }>(
      `/books/${id}/chapters`
    ),

  proposePatch: (id: string, chapterId: string, markdown: string) =>
    fetchJson<{ proposal: PatchProposal }>(`/books/${id}/propose-patch`, {
      method: "POST",
      body: JSON.stringify({ chapterId, markdown }),
    }),

  applyPatch: (id: string, proposal: PatchProposal) =>
    fetchJson<{ applied: number } & ApplyPatchResult>(`/books/${id}/apply-patch`, {
      method: "POST",
      body: JSON.stringify({ proposal }),
    }),

  search: (id: string, query: string, nodeTypes?: string[], topK?: number, threshold?: number) =>
    fetchJson<{ results: SearchResult[] }>(`/books/${id}/search`, {
      method: "POST",
      body: JSON.stringify({ query, nodeTypes, topK, threshold }),
    }),

  listCharacters: (id: string) => fetchJson<{ characters: CharacterItem[] }>(`/books/${id}/characters`),

  listEvents: (id: string) => fetchJson<{ events: EventItem[] }>(`/books/${id}/events`),

  listRelationships: (id: string) =>
    fetchJson<{ nodes: RelationshipNode[]; links: RelationshipLink[] }>(`/books/${id}/relationships`),

  simulateReader: (id: string, options?: SimulateReaderOptions) =>
    fetchJson<SimulateReaderResult>(`/books/${id}/simulate-reader`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }),

  critique: (id: string, options?: CritiqueOptions) =>
    fetchJson<CritiqueResult>(`/books/${id}/critique`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }),

  listClues: (id: string) => fetchJson<{ clues: ClueTimelineItem[] }>(`/books/${id}/clues`),

  addClue: (
    id: string,
    payload: {
      label: string;
      description?: string;
      plantAt: string;
      resolveAt?: string;
      targetId?: string;
      order?: number;
    }
  ) =>
    fetchJson<{ clue: ClueItem }>(`/books/${id}/clues`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resolveClue: (id: string, clueId: string, resolveAt: string) =>
    fetchJson<{ clue: ClueItem }>(`/books/${id}/clues/${clueId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolveAt }),
    }),

  listBranches: (id: string) => fetchJson<{ branches: Branch[] }>(`/books/${id}/branches`),

  forkBranch: (id: string, name: string) =>
    fetchJson<Branch>(`/books/${id}/branches`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  checkoutBranch: (id: string, branchId: string) =>
    fetchJson<{ branch: Branch }>(`/books/${id}/branches/${branchId}/checkout`, {
      method: "POST",
    }),

  mergeBranches: (id: string, sourceBranchId: string) =>
    fetchJson<{ proposal: MergeProposal }>(`/books/${id}/branches/${sourceBranchId}/merge`, {
      method: "POST",
    }),

  getEmbeddingConfig: (id: string) => fetchJson<{ config: EmbeddingConfigInfo }>(`/books/${id}/embedding-config`),

  reindexEmbeddings: (id: string, nodeTypes?: string[]) =>
    fetchJson<{ ok: boolean }>(`/books/${id}/reindex-embeddings`, {
      method: "POST",
      body: JSON.stringify({ nodeTypes }),
    }),
};
