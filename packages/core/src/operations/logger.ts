import { randomUUID } from "node:crypto";
import type { Book } from "../models/book.js";

export function logOperation(
  book: Book,
  opType: string,
  targetId: string | null,
  payload: Record<string, unknown> = {}
): void {
  book.store.logOperation({
    id: randomUUID(),
    bookId: book.id,
    opType,
    targetId,
    payload,
    parentHash: null,
    timestamp: new Date().toISOString(),
    agentId: null,
  });
}
