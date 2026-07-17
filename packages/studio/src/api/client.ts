import type { PatchProposal, ApplyPatchResult } from "@yanstory/core";

export type { PatchProposal, ApplyPatchResult } from "@yanstory/core";

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

  compose: (id: string, intent: string, targetWords?: number, skipConstraints?: boolean) =>
    fetchJson<{ nodeId: string; contentPath: string; wordCount: number }>(`/books/${id}/compose`, {
      method: "POST",
      body: JSON.stringify({ intent, targetWords, skipConstraints }),
    }),

  edit: (id: string, target: string, operation: string, instruction?: string) =>
    fetchJson<{ nodeId: string; contentPath: string }>(`/books/${id}/edit`, {
      method: "POST",
      body: JSON.stringify({ target, operation, instruction }),
    }),

  query: (id: string, type: string, filters?: Record<string, string | string[] | undefined>) =>
    fetchJson<{ items: unknown[] }>(`/books/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ type, filters }),
    }),

  projection: (id: string, target?: string) =>
    fetchJson<{ markdown: string; target?: string }>(`/books/${id}/projection${target ? `/${target}` : ""}`),

  listConstraints: (id: string) => fetchJson<{ constraints: ConstraintItem[] }>(`/books/${id}/constraints`),

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
};
