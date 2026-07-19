import type { Book } from "../models/book.js";
import { buildRetrievalContext } from "./retrieval.js";
import type { CritiqueOptions, CritiqueResult } from "./types.js";

function parseCritiqueJson(content: string): CritiqueResult {
  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: String(parsed.summary ?? ""),
    verdict: ["pass", "revise", "major-revision"].includes(parsed.verdict)
      ? (parsed.verdict as CritiqueResult["verdict"])
      : "revise",
    scores: {
      pacing: Number(parsed.scores?.pacing ?? 0),
      character: Number(parsed.scores?.character ?? 0),
      worldbuilding: Number(parsed.scores?.worldbuilding ?? 0),
      dialogue: Number(parsed.scores?.dialogue ?? 0),
      originality: Number(parsed.scores?.originality ?? 0),
    },
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
    genreNotes: Array.isArray(parsed.genreNotes) ? parsed.genreNotes.map(String) : [],
  };
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor: "a demanding developmental editor",
  pacing: "a pacing specialist focused on narrative momentum",
  character: "a character development coach",
  worldbuilding: "a worldbuilding consultant",
  dialogue: "a dialogue coach",
};

export async function critique(book: Book, options: CritiqueOptions = {}): Promise<CritiqueResult> {
  if (!book.llmClient) {
    throw new Error("LLM client not configured. Call book.setLLMClient(...) before critiquing.");
  }

  const target = options.target ?? "book";
  const bookNode = book.getNode("book");
  const genre = (bookNode?.properties.genre as string) ?? "fiction";
  const role = options.role ?? "editor";
  const roleDescription = ROLE_DESCRIPTIONS[role] ?? `a ${role} critic`;
  const focus = options.focus ?? ["pacing", "character", "worldbuilding", "dialogue", "originality"];

  const prompt = await book.compilePrompt(
    "critique",
    { target, role, focus },
    async () => {
      const markdown = await book.projection(target);
      const retrievalContext = await buildRetrievalContext(book, {
        queryText: markdown,
        nodeTypes: ["character", "location", "event"],
        topK: 5,
      });
      return [
        `You are ${roleDescription} reviewing a ${genre} novel chapter/scene.`,
        `Focus areas: ${focus.join(", ")}`,
        retrievalContext ? `Relevant context from the story:\n${retrievalContext}` : "",
        "Text to critique:",
        "---",
        markdown,
        "---",
        "Respond ONLY with valid JSON in this exact structure:",
        JSON.stringify({
          summary: "brief overall assessment",
          verdict: "pass | revise | major-revision",
          scores: { pacing: 0, character: 0, worldbuilding: 0, dialogue: 0, originality: 0 },
          strengths: ["strength 1"],
          weaknesses: ["weakness 1"],
          suggestions: ["actionable suggestion 1"],
          genreNotes: ["genre-specific note 1"],
        }),
        "Scores should be integers 1-10. Verdict must be one of: pass, revise, major-revision.",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  );

  const response = await book.llmClient({ messages: [{ role: "user", content: prompt }] });
  return parseCritiqueJson(response.content);
}
