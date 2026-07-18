import { useState } from "react";
import type { BookInfo, CritiqueResult } from "../api/client.js";
import { api } from "../api/client.js";

interface CritiquePanelProps {
  book: BookInfo;
}

export function CritiquePanel({ book }: CritiquePanelProps) {
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CritiqueResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.critique(book.id, {
        target: target || undefined,
        role,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const verdictColor =
    result?.verdict === "pass" ? "#dcfce7" : result?.verdict === "major-revision" ? "#fee2e2" : "#fef9c3";

  return (
    <div>
      {error && <div style={{ padding: 12, background: "#fee2e2", borderRadius: 4, marginBottom: 16 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target path (optional, default: whole book)"
            style={{ flex: 1 }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 180 }}>
            <option value="editor">Developmental Editor</option>
            <option value="pacing">Pacing</option>
            <option value="character">Character</option>
            <option value="worldbuilding">Worldbuilding</option>
            <option value="dialogue">Dialogue</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>{loading ? "Critiquing..." : "Run Critique"}</button>
      </form>

      {result && (
        <div>
          <div
            style={{
              padding: 12,
              background: verdictColor,
              borderRadius: 4,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>{result.summary}</strong>
            <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{result.verdict}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
            {Object.entries(result.scores).map(([key, value]) => (
              <div key={key} style={{ padding: 12, background: "#f9fafb", borderRadius: 4, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{key}</div>
                <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Strengths</h4>
              <ul>{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Weaknesses</h4>
              <ul>{result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          </div>

          <h4 style={{ marginBottom: 8 }}>Suggestions</h4>
          <ul style={{ marginBottom: 16 }}>
            {result.suggestions.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ul>

          <h4 style={{ marginBottom: 8 }}>Genre Notes</h4>
          <ul>
            {result.genreNotes.map((n, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
