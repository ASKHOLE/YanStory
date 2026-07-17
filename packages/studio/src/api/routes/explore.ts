import { Hono } from "hono";
import type { BookManager } from "../book-manager.js";

export function createExploreRoutes(manager: BookManager) {
  const app = new Hono();

  app.post("/:id/search", async (c) => {
    const bookId = c.req.param("id");
    const body = await c.req.json();
    const queryText = String(body.query ?? "");
    const nodeTypes = Array.isArray(body.nodeTypes) ? body.nodeTypes.map(String) : undefined;
    const topK = body.topK ? Number(body.topK) : 10;
    const threshold = body.threshold ? Number(body.threshold) : 0;

    if (!queryText) {
      return c.json({ error: "query is required" }, 400);
    }

    const book = await manager.getBook(bookId);
    await book.ensureEmbeddings(nodeTypes);
    const embeddingStore = book.getEmbeddingStore();
    if (!embeddingStore) {
      return c.json({ error: "Embedding store not available" }, 500);
    }

    const [queryVector] = await embeddingStore.embed([queryText]);
    const results = await embeddingStore.findSimilar(book.id, queryVector, {
      topK,
      threshold,
    });

    const items = results
      .map((result) => {
        const node = book.store.getNode(book.id, result.nodeId);
        if (!node) return null;
        if (nodeTypes && nodeTypes.length > 0 && !nodeTypes.includes(node.type)) return null;
        return {
          nodeId: node.id,
          type: node.type,
          label: node.label,
          score: result.score,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return c.json({ results: items });
  });

  app.get("/:id/characters", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const characters = book.findNodes("character");

    const items = characters.map((character) => {
      const appearsInEdges = book.store.findEdges({
        bookId: book.id,
        type: "appears_in",
        fromId: character.id,
      });
      const appearsIn = appearsInEdges
        .map((edge) => {
          const scene = book.store.getNode(book.id, edge.toId);
          if (!scene) return null;
          const chapterEdge = book.store
            .findEdges({ bookId: book.id, type: "contains", toId: scene.id })
            .find((e) => e.fromId.startsWith("chapter"));
          const chapter = chapterEdge ? book.store.getNode(book.id, chapterEdge.fromId) : undefined;
          return {
            sceneId: scene.id,
            chapterId: chapter?.id,
            chapterNumber: Number(chapter?.properties.chapterNumber ?? 0),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        id: character.id,
        label: character.label,
        appearsIn,
      };
    });

    return c.json({ characters: items });
  });

  app.get("/:id/events", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const events = book.findNodes("event");

    const items = events
      .map((event) => ({
        id: event.id,
        label: event.label,
        when: event.properties.when ? String(event.properties.when) : null,
        order: Number(event.properties.order ?? 0),
      }))
      .sort((a, b) => a.order - b.order);

    return c.json({ events: items });
  });

  app.get("/:id/relationships", async (c) => {
    const bookId = c.req.param("id");
    const book = await manager.getBook(bookId);
    const characters = book.findNodes("character");

    const sceneToCharacters = new Map<string, string[]>();
    for (const character of characters) {
      const edges = book.store.findEdges({
        bookId: book.id,
        type: "appears_in",
        fromId: character.id,
      });
      for (const edge of edges) {
        const list = sceneToCharacters.get(edge.toId) ?? [];
        list.push(character.id);
        sceneToCharacters.set(edge.toId, list);
      }
    }

    const pairMap = new Map<string, { source: string; target: string; scenes: string[] }>();
    for (const [sceneId, characterIds] of sceneToCharacters) {
      for (let i = 0; i < characterIds.length; i++) {
        for (let j = i + 1; j < characterIds.length; j++) {
          const a = characterIds[i];
          const b = characterIds[j];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          const entry = pairMap.get(key) ?? { source: a, target: b, scenes: [] };
          entry.scenes.push(sceneId);
          pairMap.set(key, entry);
        }
      }
    }

    const links = Array.from(pairMap.values()).map((entry) => ({
      source: entry.source,
      target: entry.target,
      strength: entry.scenes.length,
      scenes: entry.scenes,
    }));

    const nodes = characters.map((character) => ({
      id: character.id,
      label: character.label,
      type: character.type,
    }));

    return c.json({ nodes, links });
  });

  return app;
}
