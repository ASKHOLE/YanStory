import { useState } from "react";
import { PatchPanel } from "./PatchPanel.js";
import { ExplorePanel } from "./ExplorePanel.js";
import { ReaderPanel } from "./ReaderPanel.js";
import type { BookInfo, ConstraintItem } from "../api/client.js";
import { api } from "../api/client.js";

interface BookWorkspaceProps {
  book: BookInfo;
  onRefresh: () => void;
}

type Tab = "compose" | "edit" | "query" | "constraints" | "snapshots" | "projection" | "patch" | "explore" | "reader";

export function BookWorkspace({ book, onRefresh }: BookWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("compose");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showMessage(text: string) {
    setMessage(text);
    setError(null);
  }

  function showError(text: string) {
    setError(text);
    setMessage(null);
  }

  async function run<T>(promise: Promise<T>, onSuccess: (result: T) => void) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await promise;
      onSuccess(result);
      onRefresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      showError(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ flex: 1, padding: 24, overflow: "auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{book.title}</h1>
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          {book.id} · {book.genre} · {book.chapters} chapters · {book.paragraphs} paragraphs ·{" "}
          {book.constraints} constraints · {book.snapshots} snapshots
        </div>
      </header>

      <nav style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        {(["compose", "edit", "query", "constraints", "snapshots", "projection", "patch", "explore", "reader"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              background: tab === t ? "#2563eb" : "#f3f4f6",
              color: tab === t ? "#fff" : "#111827",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {message && <div style={{ padding: 12, background: "#dcfce7", borderRadius: 4, marginBottom: 16 }}>{message}</div>}
      {error && <div style={{ padding: 12, background: "#fee2e2", borderRadius: 4, marginBottom: 16 }}>{error}</div>}

      {tab === "compose" && <ComposePanel book={book} loading={loading} run={run} showMessage={showMessage} />}
      {tab === "edit" && <EditPanel book={book} loading={loading} run={run} showMessage={showMessage} />}
      {tab === "query" && <QueryPanel book={book} loading={loading} />}
      {tab === "constraints" && (
        <ConstraintsPanel book={book} loading={loading} run={run} showMessage={showMessage} />
      )}
      {tab === "snapshots" && (
        <SnapshotsPanel book={book} loading={loading} run={run} showMessage={showMessage} />
      )}
      {tab === "projection" && <ProjectionPanel book={book} />}
      {tab === "patch" && <PatchPanel book={book} onRefresh={onRefresh} />}
      {tab === "explore" && <ExplorePanel book={book} />}
      {tab === "reader" && <ReaderPanel book={book} />}
    </main>
  );
}

function ComposePanel({
  book,
  loading,
  run,
  showMessage,
}: {
  book: BookInfo;
  loading: boolean;
  run: <T>(p: Promise<T>, onSuccess: (r: T) => void) => Promise<void>;
  showMessage: (text: string) => void;
}) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const intent = String(data.get("intent") ?? "");
    const targetWords = Number(data.get("targetWords") || 0) || undefined;
    const skipConstraints = data.get("skipConstraints") === "on";
    await run(api.compose(book.id, intent, targetWords, skipConstraints), (result) =>
      showMessage(`Composed ${result.wordCount} words → ${result.nodeId}`)
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea name="intent" placeholder="Intent..." rows={4} style={{ width: "100%", marginBottom: 8 }} required />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input name="targetWords" type="number" placeholder="Target words" style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input name="skipConstraints" type="checkbox" /> Skip constraints
        </label>
      </div>
      <button type="submit" disabled={loading}>{loading ? "Composing..." : "Compose"}</button>
    </form>
  );
}

function EditPanel({
  book,
  loading,
  run,
  showMessage,
}: {
  book: BookInfo;
  loading: boolean;
  run: <T>(p: Promise<T>, onSuccess: (r: T) => void) => Promise<void>;
  showMessage: (text: string) => void;
}) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const target = String(data.get("target") ?? "");
    const operation = String(data.get("operation") ?? "");
    const instruction = String(data.get("instruction") ?? "");
    await run(api.edit(book.id, target, operation, instruction || undefined), (result) =>
      showMessage(`Edited ${result.nodeId}`)
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="target" placeholder="Target path (e.g. chapter-0001/scene-1/paragraph-1)" required style={{ width: "100%", marginBottom: 8 }} />
      <input name="operation" placeholder="Operation (e.g. soften)" required style={{ width: "100%", marginBottom: 8 }} />
      <input name="instruction" placeholder="Instruction (optional)" style={{ width: "100%", marginBottom: 8 }} />
      <button type="submit" disabled={loading}>{loading ? "Editing..." : "Edit"}</button>
    </form>
  );
}

function QueryPanel({ book, loading }: { book: BookInfo; loading: boolean }) {
  const [type, setType] = useState("characters");
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await api.query(book.id, type);
    setItems(result.items as Array<{ id: string; label: string }>);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ flex: 1 }}>
          <option value="characters">Characters</option>
          <option value="locations">Locations</option>
          <option value="events">Events</option>
          <option value="chapters">Chapters</option>
          <option value="paragraphs">Paragraphs</option>
        </select>
        <button type="submit" disabled={loading}>Query</button>
      </form>
      <ul>
        {items.map((item: { id: string; label: string }, index) => (
          <li key={item.id ?? index}>
            {item.label} <code>{item.id}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConstraintsPanel({
  book,
  loading,
  run,
  showMessage,
}: {
  book: BookInfo;
  loading: boolean;
  run: <T>(p: Promise<T>, onSuccess: (r: T) => void) => Promise<void>;
  showMessage: (text: string) => void;
}) {
  const [constraints, setConstraints] = useState<ConstraintItem[]>([]);

  async function load() {
    const result = await api.listConstraints(book.id);
    setConstraints(result.constraints);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const dsl = String(data.get("dsl") ?? "");
    await run(api.addConstraint(book.id, dsl), () => {
      showMessage("Constraint added");
      void load();
    });
    e.currentTarget.reset();
  }

  async function remove(id: string) {
    await run(api.removeConstraint(book.id, id), () => {
      showMessage("Constraint removed");
      void load();
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          name="dsl"
          placeholder='e.g. forbid 魔法 until chapter-0004'
          style={{ flex: 1 }}
          required
        />
        <button type="submit" disabled={loading}>Add</button>
      </form>
      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>Refresh</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {constraints.map((c) => (
          <li key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span><code>{c.id}</code>: {c.dsl}</span>
            <button onClick={() => remove(c.id)} disabled={loading}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SnapshotsPanel({
  book,
  loading,
  run,
  showMessage,
}: {
  book: BookInfo;
  loading: boolean;
  run: <T>(p: Promise<T>, onSuccess: (r: T) => void) => Promise<void>;
  showMessage: (text: string) => void;
}) {
  const [snapshots, setSnapshots] = useState<{ id: string; name: string; createdAt: string }[]>([]);

  async function load() {
    const result = await api.listSnapshots(book.id);
    setSnapshots(result.snapshots);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "");
    await run(api.createSnapshot(book.id, name || `manual-${Date.now()}`), () => {
      showMessage("Snapshot created");
      void load();
    });
    e.currentTarget.reset();
  }

  async function restore(id: string) {
    await run(api.restoreSnapshot(book.id, id), () => showMessage(`Restored snapshot ${id}`));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input name="name" placeholder="Snapshot name" style={{ flex: 1 }} />
        <button type="submit" disabled={loading}>Snapshot</button>
      </form>
      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>Refresh</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {snapshots.map((s) => (
          <li key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span>{s.name} <code>{s.id}</code></span>
            <button onClick={() => restore(s.id)} disabled={loading}>Restore</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectionPanel({ book }: { book: BookInfo }) {
  const [markdown, setMarkdown] = useState("");
  const [target, setTarget] = useState("");

  async function load() {
    const result = await api.projection(book.id, target || undefined);
    setMarkdown(result.markdown);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target path (optional)"
          style={{ flex: 1 }}
        />
        <button onClick={load}>Load Projection</button>
      </div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f9fafb",
          padding: 16,
          borderRadius: 4,
          maxHeight: 600,
          overflow: "auto",
        }}
      >
        {markdown || "Click Load Projection to render the novel."}
      </pre>
    </div>
  );
}
