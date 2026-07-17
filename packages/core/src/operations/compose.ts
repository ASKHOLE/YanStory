import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Book } from "../models/book.js";
import type { ComposeOptions, ComposeResult } from "./types.js";
import { logOperation } from "./logger.js";

import { snapshot } from "./snapshot.js";
import { buildRetrievalContext } from "./retrieval.js";
import { assertConstraints } from "../constraints/engine.js";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function buildComposePrompt(book: Book, chapterNumber: number, options: ComposeOptions): Promise<string> {
  const bookNode = book.getNode("book");
  const title = bookNode?.label ?? "Untitled";
  const genre = (bookNode?.properties.genre as string) ?? "fiction";
  const retrievalContext = await buildRetrievalContext(book, {
    queryText: options.intent,
    nodeTypes: ["character", "location", "event", "chapter"],
    topK: 5,
  });
  return [
    `You are writing chapter ${chapterNumber} of the ${genre} novel "${title}".`,
    `Author's intent: ${options.intent}`,
    options.targetWords ? `Target length: approximately ${options.targetWords} words.` : "",
    retrievalContext,
    "Write the chapter in Markdown. Separate paragraphs with blank lines. Do not include headings.",
    "Begin:",
  ]
    .filter(Boolean)
    .join("\n");
}

async function getNextChapterNumber(book: Book): Promise<number> {
  const chapters = book.store.findNodes({ bookId: book.id, type: "chapter" });
  if (chapters.length === 0) return 1;
  const numbers = chapters
    .map((c) => Number(c.properties.chapterNumber ?? 0))
    .filter((n) => !Number.isNaN(n));
  return Math.max(0, ...numbers) + 1;
}

export async function compose(book: Book, options: ComposeOptions): Promise<ComposeResult> {
  if (!book.llmClient) {
    throw new Error("LLM client not configured. Call book.setLLMClient(...) before composing.");
  }

  const chapterNumber = await getNextChapterNumber(book);
  const chapterId = `chapter-${chapterNumber.toString().padStart(4, "0")}`;
  const sceneId = `${chapterId}/scene-1`;

  const prompt = await buildComposePrompt(book, chapterNumber, options);
  const result = await book.llmClient({ messages: [{ role: "user", content: prompt }] });
  const content = result.content;
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  if (!options.skipConstraints) {
    for (let i = 0; i < paragraphs.length; i++) {
      assertConstraints(book, {
        targetPath: `${chapterId}/scene-1/paragraph-${i + 1}`,
        targetText: paragraphs[i].trim(),
        intent: options.intent,
      });
    }
  }

  const now = new Date().toISOString();
  const bookNode = book.getNode("book");

  book.store.createNode({
    id: chapterId,
    bookId: book.id,
    type: "chapter",
    label: `Chapter ${chapterNumber}`,
    contentUri: path.join("text", "chapters", `${chapterId}.md`),
    properties: {
      chapterNumber,
      targetWords: options.targetWords ?? 1500,
      status: "draft",
      intent: options.intent,
    },
    createdAt: now,
    updatedAt: now,
  });

  book.store.createEdge({
    id: randomUUID(),
    bookId: book.id,
    type: "contains",
    fromId: "book",
    toId: chapterId,
    properties: {},
    createdAt: now,
  });

  book.store.createNode({
    id: sceneId,
    bookId: book.id,
    type: "scene",
    label: `${chapterId} Scene 1`,
    contentUri: null,
    properties: { sceneNumber: 1 },
    createdAt: now,
    updatedAt: now,
  });

  book.store.createEdge({
    id: randomUUID(),
    bookId: book.id,
    type: "contains",
    fromId: chapterId,
    toId: sceneId,
    properties: {},
    createdAt: now,
  });

  for (let i = 0; i < paragraphs.length; i++) {
    const paraId = `${sceneId}/paragraph-${i + 1}`;
    book.store.createNode({
      id: paraId,
      bookId: book.id,
      type: "paragraph",
      label: `${sceneId} Paragraph ${i + 1}`,
      contentUri: null,
      properties: { paragraphNumber: i + 1, text: paragraphs[i].trim() },
      createdAt: now,
      updatedAt: now,
    });
    book.store.createEdge({
      id: randomUUID(),
      bookId: book.id,
      type: "contains",
      fromId: sceneId,
      toId: paraId,
      properties: {},
      createdAt: now,
    });
  }

  const contentPath = path.join(book.paths.chaptersDir, `${chapterId}.md`);
  const markdown = `# ${bookNode?.label ?? "Untitled"} - Chapter ${chapterNumber}\n\n${content}`;
  await fs.writeFile(contentPath, markdown, "utf-8");

  logOperation(book, "compose", chapterId, {
    intent: options.intent,
    targetWords: options.targetWords,
    wordCount: countWords(content),
  });

  await snapshot(book, `auto-compose-${Date.now()}`);

  const chapterNode = book.store.getNode(book.id, chapterId);
  if (!chapterNode) {
    throw new Error("Failed to create chapter node");
  }

  return { node: chapterNode, contentPath, wordCount: countWords(content) };
}
