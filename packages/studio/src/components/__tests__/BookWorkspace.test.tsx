// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookWorkspace } from "../BookWorkspace.js";

const sampleBook = {
  id: "book-1",
  title: "Test Book",
  genre: "xuanhuan",
  author: "",
  chapters: 1,
  scenes: 2,
  paragraphs: 3,
  snapshots: 0,
  constraints: 0,
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BookWorkspace", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("renders book title and stats", () => {
    render(<BookWorkspace book={sampleBook} onRefresh={vi.fn()} />);
    expect(screen.getByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText(/1 chapters/)).toBeInTheDocument();
    expect(screen.getByText(/3 paragraphs/)).toBeInTheDocument();
  });

  it("switches tabs", () => {
    render(<BookWorkspace book={sampleBook} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    expect(screen.getByPlaceholderText("Operation (e.g. soften)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "query" }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("composes a chapter and refreshes on success", async () => {
    const onRefresh = vi.fn();
    mockFetch.mockResolvedValue(
      jsonResponse({ nodeId: "chapter-0001", contentPath: "/tmp/chapter.md", wordCount: 120 })
    );

    render(<BookWorkspace book={sampleBook} onRefresh={onRefresh} />);

    fireEvent.change(screen.getByPlaceholderText("Intent..."), { target: { value: "introduce hero" } });
    fireEvent.change(screen.getByPlaceholderText("Target words"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Compose" }));

    await waitFor(() => {
      expect(screen.getByText(/Composed 120 words/)).toBeInTheDocument();
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/books/book-1/compose");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      intent: "introduce hero",
      targetWords: 100,
      skipConstraints: false,
    });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("displays an error when compose fails", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "InternalError", message: "LLM request failed: 500" }, 500));

    render(<BookWorkspace book={sampleBook} onRefresh={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Intent..."), { target: { value: "introduce hero" } });
    fireEvent.click(screen.getByRole("button", { name: "Compose" }));

    await waitFor(() => {
      expect(screen.getByText(/LLM request failed: 500/)).toBeInTheDocument();
    });
  });
});
