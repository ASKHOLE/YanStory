import { useState } from "react";
import type { BookInfo, SimulateReaderResult } from "../api/client.js";
import { api } from "../api/client.js";

interface ReaderPanelProps {
  book: BookInfo;
}

export function ReaderPanel({ book }: ReaderPanelProps) {
  const [target, setTarget] = useState("");
  const [perspective, setPerspective] = useState("first-time reader");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateReaderResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.simulateReader(book.id, {
        target: target || undefined,
        perspective,
        focus: ["comprehension", "engagement", "consistency", "suspense"],
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

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
          <select value={perspective} onChange={(e) => setPerspective(e.target.value)} style={{ width: 180 }}>
            <option value="first-time reader">First-time reader</option>
            <option value="genre fan">Genre fan</option>
            <option value="critical reader">Critical reader</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>{loading ? "Simulating..." : "Simulate Reader"}</button>
      </form>

      {result && (
        <div>
          <div style={{ padding: 12, background: "#f3f4f6", borderRadius: 4, marginBottom: 16 }}>
            <strong>Summary</strong>
            <p style={{ margin: "8px 0 0" }}>{result.summary}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {Object.entries(result.scores).map(([key, value]) => (
              <div key={key} style={{ padding: 12, background: "#f9fafb", borderRadius: 4, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{key}</div>
                <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
              </div>
            ))}
          </div>

          <h4 style={{ marginBottom: 8 }}>Highlights</h4>
          <ul style={{ listStyle: "none", padding: 0, marginBottom: 16 }}>
            {result.highlights.map((highlight, index) => (
              <li
                key={index}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 4,
                  background:
                    highlight.type === "engaging"
                      ? "#dcfce7"
                      : highlight.type === "confusing" || highlight.type === "inconsistent"
                        ? "#fee2e2"
                        : "#fef9c3",
                }}
              >
                <strong style={{ textTransform: "uppercase", fontSize: 12 }}>{highlight.type}</strong>
                {highlight.quote && <blockquote style={{ margin: "8px 0", fontStyle: "italic" }}>{highlight.quote}</blockquote>}
                <p style={{ margin: 0 }}>{highlight.reason}</p>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Questions</h4>
              <ul>
                {result.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 8 }}>Predictions</h4>
              <ul>
                {result.predictions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
