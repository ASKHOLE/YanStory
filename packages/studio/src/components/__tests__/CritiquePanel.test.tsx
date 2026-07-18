// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CritiquePanel } from "../CritiquePanel.js";

const sampleBook = {
  id: "book-1",
  title: "Critique Book",
  genre: "xuanhuan",
  author: "",
  chapters: 1,
  scenes: 0,
  paragraphs: 0,
  snapshots: 0,
  constraints: 0,
};

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CritiquePanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("runs critique and displays verdict", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        summary: "Solid chapter with pacing issues.",
        verdict: "revise",
        scores: { pacing: 5, character: 8, worldbuilding: 7, dialogue: 6, originality: 7 },
        strengths: ["Strong protagonist voice"],
        weaknesses: ["Middle drags"],
        suggestions: ["Tighten the travel scene"],
        genreNotes: ["Add a cultivation hint"],
      })
    );

    render(<CritiquePanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "Run Critique" }));

    await waitFor(() => {
      expect(screen.getByText("Solid chapter with pacing issues.")).toBeInTheDocument();
    });
    expect(screen.getByText("revise")).toBeInTheDocument();
    expect(screen.getByText("Tighten the travel scene")).toBeInTheDocument();
  });
});
