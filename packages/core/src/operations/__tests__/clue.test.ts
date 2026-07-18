import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { Book } from "../../index.js";
import { addClue, listClues, resolveClue, buildClueTimeline } from "../clue.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-clue-test-"));
}

describe("clue operations", () => {
  let projectRoot: string;
  let book: Book;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    book = await Book.create({ projectRoot, title: "Clue Test", genre: "xuanhuan" });
  });

  afterEach(async () => {
    book.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  function createEvent(id: string, label: string, order: number) {
    const now = new Date().toISOString();
    book.store.createNode({
      id,
      bookId: book.id,
      type: "event",
      label,
      contentUri: null,
      properties: { order },
      createdAt: now,
      updatedAt: now,
    });
  }

  it("adds a planted clue", async () => {
    createEvent("event-1", "Awakening", 1);

    const clue = await addClue(book, {
      label: "Mysterious symbol",
      description: "A strange mark on the door",
      plantAt: "event-1",
      order: 1,
    });

    expect(clue.label).toBe("Mysterious symbol");
    expect(clue.status).toBe("planted");
    expect(clue.plantAt).toBe("event-1");
    expect(clue.resolveAt).toBeNull();
  });

  it("adds a resolved clue", async () => {
    createEvent("event-1", "Awakening", 1);
    createEvent("event-2", "Revelation", 5);

    const clue = await addClue(book, {
      label: "Hidden letter",
      description: "Found under the floorboard",
      plantAt: "event-1",
      resolveAt: "event-2",
      targetId: "event-2",
      order: 2,
    });

    expect(clue.status).toBe("resolved");
    expect(clue.resolveAt).toBe("event-2");
    expect(clue.targetId).toBe("event-2");
  });

  it("resolves a clue and builds the timeline", async () => {
    createEvent("event-1", "Awakening", 1);
    createEvent("event-2", "Revelation", 5);

    const added = await addClue(book, {
      label: "Hidden letter",
      description: "Found under the floorboard",
      plantAt: "event-1",
      targetId: "event-2",
      order: 2,
    });

    const resolved = await resolveClue(book, {
      clueId: added.id,
      resolveAt: "event-2",
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolveAt).toBe("event-2");

    const timeline = await buildClueTimeline(book);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].plantLabel).toBe("Awakening");
    expect(timeline[0].resolveLabel).toBe("Revelation");
    expect(timeline[0].targetLabel).toBe("Revelation");
  });

  it("throws when plantAt node is missing", async () => {
    await expect(
      addClue(book, { label: "Orphan clue", plantAt: "missing" })
    ).rejects.toThrow("plantAt node not found: missing");
  });

  it("throws when resolving an already resolved clue", async () => {
    createEvent("event-1", "Awakening", 1);
    createEvent("event-2", "Revelation", 5);

    const added = await addClue(book, {
      label: "Hidden letter",
      plantAt: "event-1",
      resolveAt: "event-2",
      order: 2,
    });

    await expect(
      resolveClue(book, { clueId: added.id, resolveAt: "event-2" })
    ).rejects.toThrow(`Clue already resolved: ${added.id}`);
  });

  it("sorts clues by order then createdAt", async () => {
    createEvent("event-1", "Awakening", 1);

    const second = await addClue(book, {
      label: "Second clue",
      plantAt: "event-1",
      order: 2,
    });
    const first = await addClue(book, {
      label: "First clue",
      plantAt: "event-1",
      order: 1,
    });

    const clues = await listClues(book);
    expect(clues.map((c) => c.id)).toEqual([first.id, second.id]);
  });
});
