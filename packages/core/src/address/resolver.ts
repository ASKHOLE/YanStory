import { GraphStore } from "../graph/store.js";
import { type GraphNode } from "../graph/types.js";
import { formatAddressPath, parseAddressPath, matchSegment } from "./path.js";

export class AddressResolver {
  constructor(private readonly store: GraphStore) {}

  resolve(bookId: string, rawPath: string): GraphNode[] {
    const path = parseAddressPath(rawPath);

    if (path.segments.length === 0) {
      const book = this.store.getNode(bookId, "book");
      return book ? [book] : [];
    }

    let candidates = this.resolveFirstSegment(bookId, path.segments[0]);

    for (let i = 1; i < path.segments.length; i++) {
      const segment = path.segments[i];
      const nextCandidates: GraphNode[] = [];
      for (const parent of candidates) {
        const children = this.store
          .findNodes({ bookId, parentId: parent.id })
          .filter((node: GraphNode) => this.segmentMatchesNode(segment, node));
        nextCandidates.push(...children);
      }
      candidates = nextCandidates;
      if (candidates.length === 0) break;
    }

    return candidates;
  }

  resolveSingle(bookId: string, rawPath: string): GraphNode | undefined {
    const results = this.resolve(bookId, rawPath);
    return results[0];
  }

  private resolveFirstSegment(bookId: string, segment: string): GraphNode[] {
    const book = this.store.getNode(bookId, "book");
    if (!book) return [];

    if (segment === "book" || segment === book.id || segment === book.label) {
      return [book];
    }

    const topLevel = this.store.findNodes({ bookId, parentId: "book" });
    const matched = topLevel.filter((node: GraphNode) => this.segmentMatchesNode(segment, node));
    if (matched.length > 0) return matched;

    return this.store
      .findNodes({ bookId })
      .filter((node: GraphNode) => node.type === segment || this.segmentMatchesNode(segment, node));
  }

  private segmentMatchesNode(segment: string, node: GraphNode): boolean {
    const lastIdSegment = node.id.includes("/") ? node.id.split("/").pop() : node.id;
    return (
      matchSegment(segment, node.id) ||
      matchSegment(segment, node.label) ||
      matchSegment(segment, lastIdSegment ?? node.id) ||
      node.type === segment
    );
  }
}

export { formatAddressPath, parseAddressPath };
