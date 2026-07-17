export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  content_uri TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(book_id, type);
CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(book_id, label);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  type TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, id),
  FOREIGN KEY (book_id, from_id) REFERENCES nodes(book_id, id) ON DELETE CASCADE,
  FOREIGN KEY (book_id, to_id) REFERENCES nodes(book_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(book_id, from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(book_id, to_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(book_id, type);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  op_type TEXT NOT NULL,
  target_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  parent_hash TEXT,
  timestamp TEXT NOT NULL,
  agent_id TEXT,
  PRIMARY KEY (book_id, id)
);

CREATE INDEX IF NOT EXISTS idx_operations_time ON operations(book_id, timestamp);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  graph_hash TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, id)
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  model TEXT NOT NULL,
  vector TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, node_id),
  FOREIGN KEY (book_id, node_id) REFERENCES nodes(book_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_embeddings_node ON embeddings(book_id, node_id);
`;
