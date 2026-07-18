// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CluesPanel } from "../CluesPanel.js";

const sampleBook = {
  id: "book-1",
  title: "Clue Book",
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

describe("CluesPanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("loads and displays clues", async () => {
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

    render(
      <CluesPanel
        book={sampleBook}
        loading={false}
        setLoading={vi.fn()}
        setError={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Hidden letter")).toBeInTheDocument();
    });
    expect(screen.getByText((content) => content.includes("Planted in: Awakening"))).toBeInTheDocument();
  });

  it("adds a clue", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ clues: [] })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          clue: {
            id: "clue-2",
            label: "Mysterious symbol",
            description: "",
            status: "planted",
            plantAt: "event-1",
            resolveAt: null,
            targetId: null,
            order: 2,
            createdAt: new Date().toISOString(),
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          clues: [
            {
              id: "clue-2",
              label: "Mysterious symbol",
              description: "",
              status: "planted",
              plantAt: "event-1",
              plantLabel: "Awakening",
              resolveAt: null,
              targetId: null,
              targetLabel: undefined,
              order: 2,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

    render(
      <CluesPanel
        book={sampleBook}
        loading={false}
        setLoading={vi.fn()}
        setError={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Clue label"), {
      target: { value: "Mysterious symbol" },
    });
    fireEvent.change(screen.getByPlaceholderText("Plant at node id"), {
      target: { value: "event-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Order"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add clue" }));

    await waitFor(() => {
      expect(screen.getByText("Mysterious symbol")).toBeInTheDocument();
    });
  });
});
