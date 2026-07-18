export type NodeType =
  | "book"
  | "arc"
  | "chapter"
  | "scene"
  | "paragraph"
  | "sentence"
  | "character"
  | "location"
  | "item"
  | "event"
  | "promise"
  | "lie"
  | "debt"
  | "knowledge"
  | "emotion"
  | "timeline"
  | "constraint"
  | "note"
  | "clue";

export type EdgeType =
  | "contains"
  | "causes"
  | "enables"
  | "prevents"
  | "relates_to"
  | "knows"
  | "lies_to"
  | "owes"
  | "feels_toward"
  | "appears_in"
  | "located_at"
  | "owns"
  | "refers_to"
  | "planted_in"
  | "pays_off"
  | "foreshadows";

export interface GraphNode {
  id: string;
  bookId: string;
  type: NodeType;
  label: string;
  contentUri: string | null;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  bookId: string;
  type: EdgeType;
  fromId: string;
  toId: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  bookId: string;
  opType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  parentHash: string | null;
  timestamp: string;
  agentId: string | null;
}

export interface Snapshot {
  id: string;
  bookId: string;
  name: string;
  graphHash: string | null;
  createdAt: string;
}

export interface NodeQuery {
  bookId: string;
  type?: NodeType | NodeType[];
  label?: string;
  parentId?: string;
  limit?: number;
}

export interface EdgeQuery {
  bookId: string;
  type?: EdgeType | EdgeType[];
  fromId?: string;
  toId?: string;
}
