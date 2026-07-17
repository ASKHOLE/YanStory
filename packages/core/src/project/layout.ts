import path from "node:path";
import fs from "node:fs/promises";
import { GraphStore } from "../graph/store.js";

export interface BookListing {
  id: string;
  title: string;
  genre: string;
  createdAt: string;
}

export interface BookPaths {
  root: string;
  graphDb: string;
  textDir: string;
  chaptersDir: string;
  projectionsDir: string;
  snapshotsDir: string;
}

export interface ProjectPaths {
  root: string;
  yanstoryDir: string;
  secretsFile: string;
  booksDir: string;
}

export function getProjectPaths(projectRoot: string): ProjectPaths {
  return {
    root: projectRoot,
    yanstoryDir: path.join(projectRoot, ".yanstory"),
    secretsFile: path.join(projectRoot, ".yanstory", "secrets.json"),
    booksDir: path.join(projectRoot, "books"),
  };
}

export function getBookPaths(projectRoot: string, bookId: string): BookPaths {
  const bookRoot = path.join(projectRoot, "books", bookId);
  return {
    root: bookRoot,
    graphDb: path.join(bookRoot, "graph.db"),
    textDir: path.join(bookRoot, "text"),
    chaptersDir: path.join(bookRoot, "text", "chapters"),
    projectionsDir: path.join(bookRoot, "projections"),
    snapshotsDir: path.join(bookRoot, "snapshots"),
  };
}

export async function ensureProjectLayout(projectRoot: string): Promise<void> {
  const paths = getProjectPaths(projectRoot);
  await fs.mkdir(paths.yanstoryDir, { recursive: true });
  await fs.mkdir(paths.booksDir, { recursive: true });
}

export async function ensureBookLayout(projectRoot: string, bookId: string): Promise<BookPaths> {
  const paths = getBookPaths(projectRoot, bookId);
  await fs.mkdir(paths.chaptersDir, { recursive: true });
  await fs.mkdir(paths.projectionsDir, { recursive: true });
  await fs.mkdir(paths.snapshotsDir, { recursive: true });
  return paths;
}

export async function bookExists(projectRoot: string, bookId: string): Promise<boolean> {
  const paths = getBookPaths(projectRoot, bookId);
  try {
    const stat = await fs.stat(paths.graphDb);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function listBooks(projectRoot: string): Promise<BookListing[]> {
  const booksDir = path.join(projectRoot, "books");
  let names: string[] = [];
  try {
    names = await fs.readdir(booksDir);
  } catch {
    return [];
  }

  const listings: BookListing[] = [];
  for (const bookId of names) {
    const paths = getBookPaths(projectRoot, bookId);
    try {
      const graphStat = await fs.stat(paths.graphDb);
      if (!graphStat.isFile()) continue;
      const store = new GraphStore(paths.graphDb);
      try {
        const bookNode = store.getNode(bookId, "book");
        if (!bookNode) continue;
        listings.push({
          id: bookId,
          title: String(bookNode.properties.title ?? "Untitled"),
          genre: String(bookNode.properties.genre ?? "general"),
          createdAt: bookNode.createdAt,
        });
      } finally {
        store.close();
      }
    } catch {
      // Ignore books that cannot be opened.
    }
  }
  return listings;
}
