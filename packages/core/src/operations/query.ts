import type { Book } from "../models/book.js";
import type { QueryOptions, QueryResult } from "./types.js";

export async function query(book: Book, options: QueryOptions): Promise<QueryResult> {
  switch (options.type) {
    case "characters":
      return { items: book.findNodes("character") };
    case "locations":
      return { items: book.findNodes("location") };
    case "chapters":
      return { items: book.findNodes("chapter") };
    case "events":
      return { items: book.findNodes("event") };
    case "node": {
      const path = options.filters?.path as string | undefined;
      if (!path) {
        throw new Error('Query type "node" requires filters.path');
      }
      const node = book.getNode(path);
      return { items: node ? [node] : [] };
    }
    case "children": {
      const parentPath = options.filters?.parent as string | undefined;
      if (!parentPath) {
        throw new Error('Query type "children" requires filters.parent');
      }
      const parent = book.getNode(parentPath);
      if (!parent) return { items: [] };
      const children = book.store.findNodes({ bookId: book.id, parentId: parent.id });
      return { items: children };
    }
    default:
      return { items: [] };
  }
}
