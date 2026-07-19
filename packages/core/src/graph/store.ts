import Database from "better-sqlite3";
import {
  type Branch,
  type EdgeQuery,
  type GraphEdge,
  type GraphNode,
  type NodeQuery,
  type OperationLog,
  type Snapshot,
} from "./types.js";
import { SCHEMA_SQL } from "./schema.js";

function serializeProperties(properties: Record<string, unknown>): string {
  return JSON.stringify(properties);
}

function parseProperties(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class GraphStore {
  private db: Database.Database;
  private stateVersion = 0;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
  }

  close(): void {
    this.db.close();
  }

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  getStateVersion(): number {
    return this.stateVersion;
  }

  private bumpStateVersion(): void {
    this.stateVersion += 1;
  }

  createNode(node: GraphNode): void {
    this.bumpStateVersion();
    const stmt = this.db.prepare(
      `INSERT INTO nodes (id, book_id, type, label, content_uri, properties, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      node.id,
      node.bookId,
      node.type,
      node.label,
      node.contentUri,
      serializeProperties(node.properties),
      node.createdAt,
      node.updatedAt
    );
  }

  getNode(bookId: string, id: string): GraphNode | undefined {
    const stmt = this.db.prepare("SELECT * FROM nodes WHERE book_id = ? AND id = ?");
    const row = stmt.get(bookId, id) as Record<string, unknown> | undefined;
    return row ? this.rowToNode(row) : undefined;
  }

  updateNode(bookId: string, id: string, updates: Partial<Pick<GraphNode, "label" | "contentUri" | "properties">>): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.label !== undefined) {
      sets.push("label = ?");
      values.push(updates.label);
    }
    if (updates.contentUri !== undefined) {
      sets.push("content_uri = ?");
      values.push(updates.contentUri);
    }
    if (updates.properties !== undefined) {
      sets.push("properties = ?");
      values.push(serializeProperties(updates.properties));
    }

    if (sets.length === 0) return;

    this.bumpStateVersion();
    sets.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(bookId, id);

    const stmt = this.db.prepare(`UPDATE nodes SET ${sets.join(", ")} WHERE book_id = ? AND id = ?`);
    stmt.run(...values);
  }

  deleteNode(bookId: string, id: string): void {
    this.bumpStateVersion();
    const stmt = this.db.prepare("DELETE FROM nodes WHERE book_id = ? AND id = ?");
    stmt.run(bookId, id);
  }

  findNodes(query: NodeQuery): GraphNode[] {
    const conditions: string[] = ["book_id = ?"];
    const values: unknown[] = [query.bookId];

    if (query.type !== undefined) {
      if (Array.isArray(query.type)) {
        conditions.push(`type IN (${query.type.map(() => "?").join(", ")})`);
        values.push(...query.type);
      } else {
        conditions.push("type = ?");
        values.push(query.type);
      }
    }

    if (query.label !== undefined) {
      conditions.push("label = ?");
      values.push(query.label);
    }

    if (query.parentId !== undefined) {
      conditions.push("id IN (SELECT to_id FROM edges WHERE book_id = ? AND from_id = ? AND type = 'contains')");
      values.push(query.bookId, query.parentId);
    }

    let sql = `SELECT * FROM nodes WHERE ${conditions.join(" AND ")} ORDER BY created_at ASC`;
    if (query.limit !== undefined) {
      sql += ` LIMIT ${Number(query.limit)}`;
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...values) as Record<string, unknown>[];
    return rows.map((row) => this.rowToNode(row));
  }

  createEdge(edge: GraphEdge): void {
    this.bumpStateVersion();
    const stmt = this.db.prepare(
      `INSERT INTO edges (id, book_id, type, from_id, to_id, properties, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      edge.id,
      edge.bookId,
      edge.type,
      edge.fromId,
      edge.toId,
      serializeProperties(edge.properties),
      edge.createdAt
    );
  }

  getEdge(bookId: string, id: string): GraphEdge | undefined {
    const stmt = this.db.prepare("SELECT * FROM edges WHERE book_id = ? AND id = ?");
    const row = stmt.get(bookId, id) as Record<string, unknown> | undefined;
    return row ? this.rowToEdge(row) : undefined;
  }

  findEdges(query: EdgeQuery): GraphEdge[] {
    const conditions: string[] = ["book_id = ?"];
    const values: unknown[] = [query.bookId];

    if (query.type !== undefined) {
      if (Array.isArray(query.type)) {
        conditions.push(`type IN (${query.type.map(() => "?").join(", ")})`);
        values.push(...query.type);
      } else {
        conditions.push("type = ?");
        values.push(query.type);
      }
    }

    if (query.fromId !== undefined) {
      conditions.push("from_id = ?");
      values.push(query.fromId);
    }

    if (query.toId !== undefined) {
      conditions.push("to_id = ?");
      values.push(query.toId);
    }

    const sql = `SELECT * FROM edges WHERE ${conditions.join(" AND ")} ORDER BY created_at ASC`;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...values) as Record<string, unknown>[];
    return rows.map((row) => this.rowToEdge(row));
  }

  deleteEdge(bookId: string, id: string): void {
    this.bumpStateVersion();
    const stmt = this.db.prepare("DELETE FROM edges WHERE book_id = ? AND id = ?");
    stmt.run(bookId, id);
  }

  logOperation(operation: OperationLog): void {
    const stmt = this.db.prepare(
      `INSERT INTO operations (id, book_id, op_type, target_id, payload, parent_hash, timestamp, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      operation.id,
      operation.bookId,
      operation.opType,
      operation.targetId,
      serializeProperties(operation.payload),
      operation.parentHash,
      operation.timestamp,
      operation.agentId
    );
  }

  listOperations(bookId: string, limit = 100): OperationLog[] {
    const stmt = this.db.prepare(
      "SELECT * FROM operations WHERE book_id = ? ORDER BY timestamp DESC LIMIT ?"
    );
    const rows = stmt.all(bookId, limit) as Record<string, unknown>[];
    return rows.map((row) => this.rowToOperation(row));
  }

  createSnapshot(snapshot: Snapshot): void {
    const stmt = this.db.prepare(
      `INSERT INTO snapshots (id, book_id, name, graph_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(snapshot.id, snapshot.bookId, snapshot.name, snapshot.graphHash, snapshot.createdAt);
  }

  listSnapshots(bookId: string): Snapshot[] {
    const stmt = this.db.prepare(
      "SELECT * FROM snapshots WHERE book_id = ? ORDER BY created_at DESC"
    );
    const rows = stmt.all(bookId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToSnapshot(row));
  }

  createBranch(branch: Branch): void {
    this.bumpStateVersion();
    const stmt = this.db.prepare(
      `INSERT INTO branches (id, book_id, name, source_branch_id, source_snapshot_id, head_snapshot_id, current, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      branch.id,
      branch.bookId,
      branch.name,
      branch.sourceBranchId,
      branch.sourceSnapshotId,
      branch.headSnapshotId,
      branch.current ? 1 : 0,
      branch.createdAt
    );
  }

  listBranches(bookId: string): Branch[] {
    const stmt = this.db.prepare(
      "SELECT * FROM branches WHERE book_id = ? ORDER BY created_at ASC"
    );
    const rows = stmt.all(bookId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToBranch(row));
  }

  getCurrentBranch(bookId: string): Branch | undefined {
    const stmt = this.db.prepare(
      "SELECT * FROM branches WHERE book_id = ? AND current = 1 LIMIT 1"
    );
    const row = stmt.get(bookId) as Record<string, unknown> | undefined;
    return row ? this.rowToBranch(row) : undefined;
  }

  setBranchCurrent(bookId: string, branchId: string): void {
    this.bumpStateVersion();
    const clearStmt = this.db.prepare(
      "UPDATE branches SET current = 0 WHERE book_id = ?"
    );
    clearStmt.run(bookId);
    const setStmt = this.db.prepare(
      "UPDATE branches SET current = 1 WHERE book_id = ? AND id = ?"
    );
    setStmt.run(bookId, branchId);
  }

  updateBranchHead(bookId: string, branchId: string, snapshotId: string): void {
    this.bumpStateVersion();
    const stmt = this.db.prepare(
      "UPDATE branches SET head_snapshot_id = ? WHERE book_id = ? AND id = ?"
    );
    stmt.run(snapshotId, bookId, branchId);
  }

  transaction<T>(callback: () => T): T {
    const tx = this.db.transaction(callback);
    return tx();
  }

  private rowToNode(row: Record<string, unknown>): GraphNode {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      type: String(row.type) as GraphNode["type"],
      label: String(row.label),
      contentUri: row.content_uri === null ? null : String(row.content_uri),
      properties: parseProperties(String(row.properties)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private rowToEdge(row: Record<string, unknown>): GraphEdge {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      type: String(row.type) as GraphEdge["type"],
      fromId: String(row.from_id),
      toId: String(row.to_id),
      properties: parseProperties(String(row.properties)),
      createdAt: String(row.created_at),
    };
  }

  private rowToOperation(row: Record<string, unknown>): OperationLog {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      opType: String(row.op_type),
      targetId: row.target_id === null ? null : String(row.target_id),
      payload: parseProperties(String(row.payload)),
      parentHash: row.parent_hash === null ? null : String(row.parent_hash),
      timestamp: String(row.timestamp),
      agentId: row.agent_id === null ? null : String(row.agent_id),
    };
  }

  private rowToSnapshot(row: Record<string, unknown>): Snapshot {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      name: String(row.name),
      graphHash: row.graph_hash === null ? null : String(row.graph_hash),
      createdAt: String(row.created_at),
    };
  }

  private rowToBranch(row: Record<string, unknown>): Branch {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      name: String(row.name),
      sourceBranchId: row.source_branch_id === null ? null : String(row.source_branch_id),
      sourceSnapshotId: row.source_snapshot_id === null ? null : String(row.source_snapshot_id),
      headSnapshotId: row.head_snapshot_id === null ? null : String(row.head_snapshot_id),
      current: Number(row.current) === 1,
      createdAt: String(row.created_at),
    };
  }
}
