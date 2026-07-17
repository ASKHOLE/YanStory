// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PatchPanel } from "../PatchPanel.js";

const sampleBook = {
  id: "book-1",
  title: "Patch Book",
  genre: "xuanhuan",
  author: "",
  chapters: 1,
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

describe("PatchPanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  function setupStandardResponses() {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ chapters: [{ id: "chapter-0001", label: "Chapter 1", chapterNumber: 1, contentUri: "text/chapters/chapter-0001.md" }] }))
      .mockResolvedValueOnce(jsonResponse({ markdown: "Original paragraph." }));
  }

  it("loads chapters and displays the selected chapter markdown", async () => {
    setupStandardResponses();
    render(<PatchPanel book={sampleBook} onRefresh={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original paragraph.")).toBeInTheDocument();
    });
    expect(screen.getByRole("combobox")).toHaveValue("chapter-0001");
  });

  it("proposes a patch and shows operations", async () => {
    setupStandardResponses();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        proposal: {
          id: "patch-1",
          description: "1 diff",
          operations: [{ op: "update", path: "chapter-0001/scene-1/paragraph-1", properties: { text: "Updated paragraph." } }],
        },
      })
    );

    render(<PatchPanel book={sampleBook} onRefresh={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original paragraph.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Updated paragraph." } });
    fireEvent.click(screen.getByRole("button", { name: "Propose Patch" }));

    await waitFor(() => {
      expect(screen.getByText(/Proposed Changes/)).toBeInTheDocument();
    });
    expect(screen.getByText("UPDATE")).toBeInTheDocument();
  });

  it("applies a patch and refreshes", async () => {
    setupStandardResponses();
    const proposal = {
      id: "patch-1",
      description: "1 diff",
      operations: [{ op: "update", path: "chapter-0001/scene-1/paragraph-1", properties: { text: "Updated paragraph." } }],
    };
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ proposal }))
      .mockResolvedValueOnce(jsonResponse({ applied: 1 }))
      .mockResolvedValueOnce(jsonResponse({ markdown: "Updated paragraph." }));

    const onRefresh = vi.fn();
    render(<PatchPanel book={sampleBook} onRefresh={onRefresh} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original paragraph.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Updated paragraph." } });
    fireEvent.click(screen.getByRole("button", { name: "Propose Patch" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply Patch" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply Patch" }));

    await waitFor(() => {
      expect(screen.getByText(/Applied 1 operations/)).toBeInTheDocument();
    });
    expect(onRefresh).toHaveBeenCalled();
  });
});
