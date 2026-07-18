// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReaderPanel } from "../ReaderPanel.js";

const sampleBook = {
  id: "book-1",
  title: "Reader Book",
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

describe("ReaderPanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("simulates reader and displays scores", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        summary: "Engaging opening.",
        scores: { comprehension: 8, engagement: 9, consistency: 7, suspense: 6 },
        highlights: [{ type: "engaging", reason: "Strong hook" }],
        questions: ["Who is the mentor?"],
        predictions: ["The hero will leave the village."],
      })
    );

    render(<ReaderPanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate Reader" }));

    await waitFor(() => {
      expect(screen.getByText("Engaging opening.")).toBeInTheDocument();
    });
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Who is the mentor?")).toBeInTheDocument();
    expect(screen.getByText("The hero will leave the village.")).toBeInTheDocument();
  });
});
