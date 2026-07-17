import path from "node:path";
import fs from "node:fs/promises";
import type { Book } from "../models/book.js";

export async function buildProjection(book: Book, target?: string): Promise<string> {
  const chapters = book.store.findNodes({ bookId: book.id, type: "chapter" });
  const sorted = chapters.sort(
    (a, b) => Number(a.properties.chapterNumber ?? 0) - Number(b.properties.chapterNumber ?? 0)
  );

  if (target) {
    const single = book.resolver.resolveSingle(book.id, target);
    if (!single) return "";
    return await projectNode(book, single);
  }

  const parts: string[] = [];
  for (const chapter of sorted) {
    parts.push(`# ${chapter.label}\n`);
    parts.push(await projectNode(book, chapter));
  }

  return parts.join("\n");
}

async function projectNode(book: Book, node: Awaited<ReturnType<Book["getNode"]>>): Promise<string> {
  if (!node) return "";

  if (node.contentUri) {
    const filePath = path.join(book.paths.root, node.contentUri);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return "";
    }
  }

  if (node.type === "paragraph") {
    return (node.properties.text as string) ?? "";
  }

  const children = book.store
    .findNodes({ bookId: book.id, parentId: node.id })
    .sort((a, b) => {
      const aNum = Number(a.properties.paragraphNumber ?? a.properties.sceneNumber ?? 0);
      const bNum = Number(b.properties.paragraphNumber ?? b.properties.sceneNumber ?? 0);
      return aNum - bNum;
    });

  const parts: string[] = [];
  for (const child of children) {
    parts.push(await projectNode(book, child));
  }
  return parts.join("\n\n");
}
