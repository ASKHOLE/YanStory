// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExplorePanel } from "../ExplorePanel.js";

const sampleBook = {
  id: "book-1",
  title: "Explore Book",
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

describe("ExplorePanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("searches and displays results", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          { nodeId: "paragraph-1", type: "paragraph", label: "Paragraph 1", score: 0.95 },
        ],
      })
    );

    render(<ExplorePanel book={sampleBook} />);

    fireEvent.change(screen.getByPlaceholderText("Search by meaning..."), {
      target: { value: "hero" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Paragraph 1")).toBeInTheDocument();
    });
    expect(screen.getByText(/0\.950/)).toBeInTheDocument();
  });

  it("switches to characters tab and loads characters", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        characters: [
          {
            id: "character-hero",
            label: "Hero",
            appearsIn: [{ sceneId: "scene-1", chapterId: "chapter-1", chapterNumber: 1 }],
          },
        ],
      })
    );

    render(<ExplorePanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "characters" }));

    await waitFor(() => {
      expect(screen.getByText("Hero")).toBeInTheDocument();
    });
    expect(screen.getByText(/Ch\.1/)).toBeInTheDocument();
  });

  it("switches to events tab and loads events", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        events: [{ id: "event-1", label: "Awakening", when: "Chapter 1", order: 1 }],
      })
    );

    render(<ExplorePanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "events" }));

    await waitFor(() => {
      expect(screen.getByText("Awakening")).toBeInTheDocument();
    });
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
  });

  it("switches to relationships tab and loads links", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        nodes: [
          { id: "character-hero", label: "Hero", type: "character" },
          { id: "character-mentor", label: "Mentor", type: "character" },
        ],
        links: [{ source: "character-hero", target: "character-mentor", strength: 2, scenes: ["scene-1"] }],
      })
    );

    render(<ExplorePanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "relationships" }));

    await waitFor(() => {
      expect(screen.getByText(/Hero/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Mentor/)).toBeInTheDocument();
    expect(screen.getByText(/—2 shared scenes—/)).toBeInTheDocument();
  });

  it("switches to clues tab and loads clues", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        clues: [
          {
            id: "clue-1",
            label: "Hidden letter",
            description: "Under the floorboard",
            status: "planted",
            plantAt: "event-1",
            plantLabel: "Awakening",
            resolveAt: null,
            targetId: null,
            targetLabel: undefined,
            order: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );

    render(<ExplorePanel book={sampleBook} />);
    fireEvent.click(screen.getByRole("button", { name: "clues" }));

    await waitFor(() => {
      expect(screen.getByText("Hidden letter")).toBeInTheDocument();
    });
    expect(screen.getByText((content) => content.includes("Planted in: Awakening"))).toBeInTheDocument();
  });
});
