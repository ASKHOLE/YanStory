import { useEffect, useState } from "react";
import type { BookInfo, PatchProposal } from "../api/client.js";
import { api } from "../api/client.js";

interface PatchPanelProps {
  book: BookInfo;
  onRefresh: () => void;
}

interface ChapterItem {
  id: string;
  label: string;
  chapterNumber: number;
  contentUri: string;
}

export function PatchPanel({ book, onRefresh }: PatchPanelProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [proposal, setProposal] = useState<PatchProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadChapters() {
      try {
        const result = await api.listChapters(book.id);
        if (cancelled) return;
        setChapters(result.chapters);
        if (result.chapters.length > 0 && !selectedChapterId) {
          setSelectedChapterId(result.chapters[0].id);
        }
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        setError(text);
      }
    }
    void loadChapters();
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  useEffect(() => {
    if (!selectedChapterId) return;
    let cancelled = false;
    async function loadMarkdown() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.projection(book.id, selectedChapterId ?? undefined);
        if (cancelled) return;
        setMarkdown(result.markdown);
        setProposal(null);
        setMessage(null);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        if (!cancelled) setError(text);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMarkdown();
    return () => {
      cancelled = true;
    };
  }, [book.id, selectedChapterId]);

  async function handlePropose() {
    if (!selectedChapterId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.proposePatch(book.id, selectedChapterId, markdown);
      setProposal(result.proposal);
      if (result.proposal.operations.length === 0) {
        setMessage("No differences detected.");
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!proposal) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.applyPatch(book.id, proposal);
      setProposal(null);
      setMessage(`Applied ${result.applied} operations.`);
      onRefresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() {
    setProposal(null);
    setMessage(null);
    setError(null);
    // Reload markdown for the selected chapter.
    if (selectedChapterId) {
      setSelectedChapterId(selectedChapterId);
    }
  }

  return (
    <div>
      {message && <div style={{ padding: 12, background: "#dcfce7", borderRadius: 4, marginBottom: 16 }}>{message}</div>}
      {error && <div style={{ padding: 12, background: "#fee2e2", borderRadius: 4, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select
          value={selectedChapterId ?? ""}
          onChange={(e) => setSelectedChapterId(e.target.value)}
          style={{ flex: 1 }}
          disabled={loading}
        >
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.label}
            </option>
          ))}
        </select>
        <button onClick={handlePropose} disabled={loading || !selectedChapterId}>
          {loading ? "Proposing..." : "Propose Patch"}
        </button>
      </div>

      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        disabled={loading}
        rows={16}
        style={{ width: "100%", marginBottom: 16, fontFamily: "monospace" }}
      />

      {proposal && proposal.operations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Proposed Changes ({proposal.operations.length})</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {proposal.operations.map((operation, index) => (
              <li
                key={`${operation.op}-${operation.path}-${index}`}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  background: operation.op === "delete" ? "#fee2e2" : operation.op === "create" ? "#dcfce7" : "#fef9c3",
                }}
              >
                <strong>{operation.op.toUpperCase()}</strong>{" "}
                <code>{operation.path}</code>
                {operation.properties?.text ? (
                  <div style={{ marginTop: 8, fontStyle: "italic" }}>
                    {String(operation.properties.text).slice(0, 200)}
                    {String(operation.properties.text).length > 200 ? "..." : ""}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleApply} disabled={loading}>{loading ? "Applying..." : "Apply Patch"}</button>
            <button onClick={handleDiscard} disabled={loading}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
