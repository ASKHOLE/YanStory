import path from "node:path";
import fs from "node:fs/promises";
import type { Book } from "../models/book.js";
import type { EditOptions, EditResult } from "./types.js";
import { logOperation } from "./logger.js";

import { buildRetrievalContext } from "./retrieval.js";
import { snapshot } from "./snapshot.js";
import { assertConstraints } from "../constraints/engine.js";

export async function edit(book: Book, options: EditOptions): Promise<EditResult> {
  if (!book.llmClient) {
    throw new Error("LLM client not configured. Call book.setLLMClient(...) before editing.");
  }

  const node = book.resolver.resolveSingle(book.id, options.target);
  if (!node) {
    throw new Error(`Target not found: ${options.target}`);
  }

  const currentText = (node.properties.text as string) ?? "";
  const retrievalContext = await buildRetrievalContext(book, {
    queryText: `${options.operation} ${options.instruction ?? ""} ${currentText}`.trim(),
    nodeTypes: ["character", "location", "event", "chapter"],
    topK: 5,
  });
  const prompt = [
    `Edit the following text. Operation: ${options.operation}`,
    options.instruction ? `Instruction: ${options.instruction}` : "",
    retrievalContext,
    "Current text:",
    currentText,
    "Edited text:",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await book.llmClient({ messages: [{ role: "user", content: prompt }] });
  const newText = result.content.trim();

  if (!options.skipConstraints) {
    assertConstraints(book, {
      targetPath: options.target,
      targetText: newText,
      intent: `${options.operation} ${options.instruction ?? ""}`.trim(),
    });
  }

  book.store.updateNode(book.id, node.id, {
    properties: { ...node.properties, text: newText },
  });

  const contentUri = node.contentUri;
  if (contentUri) {
    const contentPath = path.join(book.paths.root, contentUri);
    await fs.writeFile(contentPath, newText, "utf-8");
  }

  logOperation(book, "edit", node.id, {
    target: options.target,
    operation: options.operation,
    instruction: options.instruction,
  });

  await snapshot(book, `auto-edit-${Date.now()}`);

  const updatedNode = book.store.getNode(book.id, node.id);
  if (!updatedNode) {
    throw new Error("Failed to update node");
  }

  return { node: updatedNode, contentPath: contentUri ? path.join(book.paths.root, contentUri) : "" };
}
