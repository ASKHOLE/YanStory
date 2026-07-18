import { useEffect, useState } from "react";
import type { BookInfo, Branch, MergeProposal } from "../api/client.js";
import { api } from "../api/client.js";

interface BranchesPanelProps {
  book: BookInfo;
  loading: boolean;
  run: <T>(p: Promise<T>, onSuccess: (r: T) => void) => Promise<void>;
  showMessage: (text: string) => void;
}

export function BranchesPanel({ book, loading, run, showMessage }: BranchesPanelProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [proposal, setProposal] = useState<MergeProposal | null>(null);

  async function load() {
    const result = await api.listBranches(book.id);
    setBranches(result.branches);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    await run(api.forkBranch(book.id, name || `branch-${Date.now()}`), () => {
      showMessage(`Forked branch ${name}`);
      void load();
    });
    form.reset();
  }

  async function checkout(branchId: string, name: string) {
    await run(api.checkoutBranch(book.id, branchId), () => {
      showMessage(`Switched to ${name}`);
      void load();
    });
  }

  async function previewMerge(branchId: string) {
    const result = await api.mergeBranches(book.id, branchId);
    setProposal(result.proposal);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input name="name" placeholder="New branch name" style={{ flex: 1 }} required />
        <button type="submit" disabled={loading}>Fork</button>
      </form>

      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>Refresh</button>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {branches.map((b) => (
          <li
            key={b.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span>
              <strong>{b.name}</strong>{" "}
              <code style={{ color: "#6b7280" }}>{b.id}</code>{" "}
              {b.current && (
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "#dcfce7",
                    color: "#166534",
                    fontSize: 10,
                    textTransform: "uppercase",
                  }}
                >
                  current
                </span>
              )}
              <div style={{ fontSize: 12, color: "#6b7280" }}>{new Date(b.createdAt).toLocaleString()}</div>
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              {!b.current && (
                <>
                  <button onClick={() => checkout(b.id, b.name)} disabled={loading}>
                    Checkout
                  </button>
                  <button onClick={() => previewMerge(b.id)} disabled={loading}>
                    Merge
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      {proposal && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: proposal.conflicts.length > 0 ? "#fee2e2" : "#f0fdf4",
            borderRadius: 4,
          }}
        >
          <strong>Merge proposal</strong>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{proposal.description}</div>
          <div style={{ fontSize: 14 }}>
            Operations: {proposal.operations.length} · Conflicts:{" "}
            <span style={{ color: proposal.conflicts.length > 0 ? "#991b1b" : "inherit", fontWeight: proposal.conflicts.length > 0 ? 600 : "inherit" }}>
              {proposal.conflicts.length}
            </span>
          </div>
          {proposal.conflicts.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 13 }}>
              {proposal.conflicts.map((c, i) => (
                <li key={i}>
                  {c.nodeId} · {c.field}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
