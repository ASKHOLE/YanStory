import { useEffect, useState } from "react";
import type { BookInfo, ClueItem, ClueTimelineItem } from "../api/client.js";
import { api } from "../api/client.js";

interface CluesPanelProps {
  book: BookInfo;
  loading: boolean;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export function CluesPanel({ book, loading, setLoading, setError }: CluesPanelProps) {
  const [clues, setClues] = useState<ClueTimelineItem[]>([]);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [plantAt, setPlantAt] = useState("");
  const [targetId, setTargetId] = useState("");
  const [order, setOrder] = useState("");
  const [resolveAt, setResolveAt] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listClues(book.id);
      setClues(response.clues);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.addClue(book.id, {
        label,
        description: description || undefined,
        plantAt,
        targetId: targetId || undefined,
        order: order ? Number(order) : undefined,
      });
      setLabel("");
      setDescription("");
      setPlantAt("");
      setTargetId("");
      setOrder("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(clueId: string) {
    if (!resolveAt) return;
    setLoading(true);
    setError(null);
    try {
      await api.resolveClue(book.id, clueId, resolveAt);
      setResolveAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  return (
    <div>
      <form
        onSubmit={handleAdd}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Clue label"
          required
          style={{ flex: 1 }}
        />
        <input
          value={plantAt}
          onChange={(e) => setPlantAt(e.target.value)}
          placeholder="Plant at node id"
          required
          style={{ width: 180 }}
        />
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="Foreshadows node id (optional)"
          style={{ width: 220 }}
        />
        <input
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          type="number"
          placeholder="Order"
          required
          style={{ width: 100 }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          style={{ width: "100%" }}
        />
        <button type="submit" disabled={loading}>Add clue</button>
      </form>

      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>
        {loading ? "Loading..." : "Refresh"}
      </button>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {(clues ?? []).map((clue) => (
          <li
            key={clue.id}
            style={{
              padding: 12,
              marginBottom: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>{clue.label}</strong>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  textTransform: "uppercase",
                  background: clue.status === "resolved" ? "#dcfce7" : "#fef9c3",
                }}
              >
                {clue.status}
              </span>
            </div>
            <div style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
              {clue.description}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              Planted in: {clue.plantLabel}
              {clue.targetLabel ? ` · Foreshadows: ${clue.targetLabel}` : ""}
            </div>
            {clue.status === "resolved" ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Resolved in: {clue.resolveLabel}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleResolve(clue.id);
                }}
                style={{ display: "flex", gap: 8, marginTop: 8 }}
              >
                <input
                  value={resolveAt}
                  onChange={(e) => setResolveAt(e.target.value)}
                  placeholder="Resolve at node id"
                  required
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={loading}>Resolve</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {!loading && clues.length === 0 && (
        <p style={{ color: "#6b7280" }}>No clues found.</p>
      )}
    </div>
  );
}
