// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchesPanel } from "../BranchesPanel.js";

const sampleBook = {
  id: "book-1",
  title: "Branch Book",
  genre: "xuanhuan",
  author: "",
  chapters: 0,
  scenes: 0,
  paragraphs: 0,
  snapshots: 0,
  constraints: 0,
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BranchesPanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("loads and displays branches", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        branches: [
          { id: "main", bookId: "book-1", name: "main", current: true, createdAt: "2026-07-19T00:00:00Z" },
          { id: "branch-1", bookId: "book-1", name: "feature", current: false, createdAt: "2026-07-19T01:00:00Z" },
        ],
      })
    );

    render(
      <BranchesPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("main", { selector: "strong" })).toBeInTheDocument();
    });
    expect(screen.getByText("feature", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Checkout" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Merge" })).toHaveLength(1);
  });

  it("forks a new branch from the form", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          branches: [{ id: "main", bookId: "book-1", name: "main", current: true, createdAt: "2026-07-19T00:00:00Z" }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "branch-2", bookId: "book-1", name: "experiment", current: false, createdAt: "2026-07-19T02:00:00Z" })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          branches: [
            { id: "main", bookId: "book-1", name: "main", current: true, createdAt: "2026-07-19T00:00:00Z" },
            { id: "branch-2", bookId: "book-1", name: "experiment", current: false, createdAt: "2026-07-19T02:00:00Z" },
          ],
        })
      );

    render(
      <BranchesPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("main", { selector: "strong" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("New branch name"), { target: { value: "experiment" } });
    fireEvent.click(screen.getByRole("button", { name: "Fork" }));

    await waitFor(() => {
      expect(screen.getByText("experiment")).toBeInTheDocument();
    });
  });

  it("checks out a non-current branch", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          branches: [
            { id: "main", bookId: "book-1", name: "main", current: true, createdAt: "2026-07-19T00:00:00Z" },
            { id: "branch-1", bookId: "book-1", name: "feature", current: false, createdAt: "2026-07-19T01:00:00Z" },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ branch: { id: "branch-1", bookId: "book-1", name: "feature", current: true, createdAt: "2026-07-19T01:00:00Z" } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          branches: [
            { id: "main", bookId: "book-1", name: "main", current: false, createdAt: "2026-07-19T00:00:00Z" },
            { id: "branch-1", bookId: "book-1", name: "feature", current: true, createdAt: "2026-07-19T01:00:00Z" },
          ],
        })
      );

    render(
      <BranchesPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("feature", { selector: "strong" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Checkout" })[0]);

    await waitFor(() => {
      const rows = screen.getAllByText("current");
      expect(rows.length).toBe(1);
    });
  });

  it("previews a merge and shows proposal summary", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          branches: [
            { id: "main", bookId: "book-1", name: "main", current: true, createdAt: "2026-07-19T00:00:00Z" },
            { id: "branch-1", bookId: "book-1", name: "feature", current: false, createdAt: "2026-07-19T01:00:00Z" },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          proposal: {
            id: "merge-1",
            description: "Merge proposal from feature into main",
            sourceBranchId: "branch-1",
            targetBranchId: "main",
            operations: [{ op: "create", path: "new-node", nodeType: "note", properties: {} }],
            conflicts: [],
          },
        })
      );

    render(
      <BranchesPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("feature", { selector: "strong" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Merge" })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Merge proposal from feature into main/)).toBeInTheDocument();
    });
    const summary = screen.getByText(
      (_, element) => element?.tagName === "DIV" && element.textContent === "Operations: 1 · Conflicts: 0"
    );
    expect(summary).toBeInTheDocument();
  });
});
