import type { Book } from "../models/book.js";
import { buildRetrievalContext } from "./retrieval.js";
import type { SimulateReaderOptions, SimulateReaderResult } from "./types.js";

function parseReaderJson(content: string): SimulateReaderResult {
  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: String(parsed.summary ?? ""),
    scores: {
      comprehension: Number(parsed.scores?.comprehension ?? 0),
      engagement: Number(parsed.scores?.engagement ?? 0),
      consistency: Number(parsed.scores?.consistency ?? 0),
      suspense: Number(parsed.scores?.suspense ?? 0),
    },
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.map((h: unknown) => ({
          type: String((h as Record<string, unknown>).type ?? "memorable") as SimulateReaderResult["highlights"][number]["type"],
          quote: (h as Record<string, unknown>).quote ? String((h as Record<string, unknown>).quote) : undefined,
          reason: String((h as Record<string, unknown>).reason ?? ""),
        }))
      : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions.map(String) : [],
    predictions: Array.isArray(parsed.predictions) ? parsed.predictions.map(String) : [],
  };
}

export async function simulateReader(
  book: Book,
  options: SimulateReaderOptions = {}
): Promise<SimulateReaderResult> {
  if (!book.llmClient) {
    throw new Error("LLM client not configured. Call book.setLLMClient(...) before simulating reader.");
  }

  const target = options.target ?? "book";
  const markdown = await book.projection(target);
  const retrievalContext = await buildRetrievalContext(book, {
    queryText: markdown,
    nodeTypes: ["character", "location", "event"],
    topK: 5,
  });

  const perspective = options.perspective ?? "a first-time reader of this genre";
  const focus = options.focus ?? ["comprehension", "engagement", "consistency", "suspense"];

  const prompt = [
    "You are simulating a reader who has just read the following chapter/scene of a novel.",
    `Reader perspective: ${perspective}`,
    `Focus areas: ${focus.join(", ")}`,
    retrievalContext ? `Relevant context from earlier in the story:\n${retrievalContext}` : "",
    "Text to evaluate:",
    "---",
    markdown,
    "---",
    "Respond ONLY with valid JSON in this exact structure:",
    JSON.stringify({
      summary: "short overall reaction",
      scores: { comprehension: 0, engagement: 0, consistency: 0, suspense: 0 },
      highlights: [{ type: "engaging", quote: "optional quoted text", reason: "why" }],
      questions: ["question 1"],
      predictions: ["prediction 1"],
    }),
    'Scores should be integers 1-10. Highlight type must be one of: "confusing", "engaging", "boring", "inconsistent", "memorable".',
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await book.llmClient({ messages: [{ role: "user", content: prompt }] });
  return parseReaderJson(response.content);
}
