// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConstraintsPanel } from "../ConstraintsPanel.js";

const sampleBook = {
  id: "book-1",
  title: "Constraint Book",
  genre: "xuanhuan",
  author: "",
  chapters: 4,
  scenes: 0,
  paragraphs: 0,
  snapshots: 0,
  constraints: 1,
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ConstraintsPanel", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("loads and displays constraints list by default", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ constraints: [{ id: "c-1", dsl: "forbid 魔法 until chapter-0004" }] })
    );

    render(
      <ConstraintsPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/forbid 魔法 until chapter-0004/)).toBeInTheDocument();
    });
  });

  it("switches to timeline view and renders axis", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ constraints: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          timeline: [
            {
              id: "c-1",
              dsl: "forbid 主角使用魔法 until chapter-0004",
              kind: "forbid",
              subject: "主角使用魔法",
              target: {
                type: "chapter",
                id: "chapter-0004",
                label: "Reveal",
                chapterNumber: 4,
              },
              startChapterNumber: 1,
              endChapterNumber: 4,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          chapters: [
            { id: "chapter-0001", label: "Opening", chapterNumber: 1, contentUri: "" },
            { id: "chapter-0004", label: "Reveal", chapterNumber: 4, contentUri: "" },
          ],
        })
      );

    render(
      <ConstraintsPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    await waitFor(() => {
      expect(screen.getByText("1. Opening")).toBeInTheDocument();
    });
    expect(screen.getByText("4. Reveal")).toBeInTheDocument();
    expect(screen.getByText("主角使用魔法")).toBeInTheDocument();
  });

  it("adds a constraint and refreshes list", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ constraints: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "c-2", dsl: "require 觉醒 before chapter-0003" }))
      .mockResolvedValueOnce(
        jsonResponse({ constraints: [{ id: "c-2", dsl: "require 觉醒 before chapter-0003" }] })
      );

    render(
      <ConstraintsPanel
        book={sampleBook}
        loading={false}
        run={async (p, onSuccess) => onSuccess(await p)}
        showMessage={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. forbid 魔法 until chapter-0004"), {
      target: { value: "require 觉醒 before chapter-0003" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText(/require 觉醒 before chapter-0003/)).toBeInTheDocument();
    });
  });
});
