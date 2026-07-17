import path from "node:path";
import fs from "node:fs/promises";
import type { Book } from "../models/book.js";
import type { PatchOperation, PatchProposal } from "../operations/types.js";

function parseMarkdownChapter(filePath: string, content: string): Array<{ id: string; text: string }> {
  const lines = content.split("\n");
  const paragraphs: Array<{ id: string; text: string }> = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (line.trim().length === 0) {
      if (current.length > 0) {
        paragraphs.push({ id: `paragraph-${paragraphs.length + 1}`, text: current.join(" ").trim() });
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }

  if (current.length > 0) {
    paragraphs.push({ id: `paragraph-${paragraphs.length + 1}`, text: current.join(" ").trim() });
  }

  return paragraphs;
}

export async function proposePatch(book: Book): Promise<PatchProposal> {
  const operations: PatchOperation[] = [];

  const chapters = book.store.findNodes({ bookId: book.id, type: "chapter" });
  for (const chapter of chapters) {
    if (!chapter.contentUri) continue;

    const filePath = path.join(book.paths.root, chapter.contentUri);
    const content = await fs.readFile(filePath, "utf-8");
    const fileParagraphs = parseMarkdownChapter(filePath, content);

    const scenes = book.store.findNodes({ bookId: book.id, parentId: chapter.id, type: "scene" });
    for (const scene of scenes) {
      const existingParagraphs = book.store.findNodes({
        bookId: book.id,
        parentId: scene.id,
        type: "paragraph",
      });

      for (let i = 0; i < Math.max(fileParagraphs.length, existingParagraphs.length); i++) {
        const filePara = fileParagraphs[i];
        const existingPara = existingParagraphs[i];

        if (!filePara && existingPara) {
          operations.push({
            op: "delete",
            path: existingPara.id,
          });
        } else if (filePara && !existingPara) {
          operations.push({
            op: "create",
            path: `${scene.id}/paragraph-${i + 1}`,
            nodeType: "paragraph",
            properties: { paragraphNumber: i + 1, text: filePara.text },
          });
        } else if (filePara && existingPara) {
          const existingText = (existingPara.properties.text as string) ?? "";
          if (existingText !== filePara.text) {
            operations.push({
              op: "update",
              path: existingPara.id,
              properties: { text: filePara.text },
            });
          }
        }
      }
    }
  }

  return {
    id: `patch-${Date.now()}`,
    description: `Detected ${operations.length} differences between Markdown files and state graph.`,
    operations,
  };
}
