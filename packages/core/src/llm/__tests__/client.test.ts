import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLLMClient } from "../client.js";

function createJsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("createLLMClient", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("returns non-streaming completion", async () => {
    mockFetch.mockResolvedValue(
      createJsonResponse({
        choices: [{ message: { content: "hello" } }],
        model: "gpt-4",
        usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
      })
    );

    const client = createLLMClient({
      apiKey: "key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4",
    });
    const result = await client({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("hello");
    expect(result.model).toBe("gpt-4");
    expect(result.usage).toEqual({ promptTokens: 2, completionTokens: 1, totalTokens: 3 });
  });

  it("retries on 500 then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(createJsonResponse({ error: "server error" }, 500))
      .mockResolvedValueOnce(createJsonResponse({ choices: [{ message: { content: "ok" } }], model: "gpt-4" }));

    const client = createLLMClient({
      apiKey: "key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4",
    });
    const result = await client({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(createJsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(createJsonResponse({ choices: [{ message: { content: "ok" } }], model: "gpt-4" }));

    const client = createLLMClient({
      apiKey: "key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4",
    });
    const result = await client({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    mockFetch.mockResolvedValue(createJsonResponse({ error: "bad request" }, 400));

    const client = createLLMClient({
      apiKey: "key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4",
    });
    await expect(client({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow("LLM request failed: 400");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("streams chunks via onChunk", async () => {
    const events = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " world" } }] })}\n\n`,
      "data: [DONE]\n\n",
    ];
    mockFetch.mockResolvedValue(createStreamResponse(events));

    const chunks: string[] = [];
    const client = createLLMClient({
      apiKey: "key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4",
    });
    const result = await client({
      messages: [{ role: "user", content: "hi" }],
      stream: true,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(["Hello", " world"]);
    expect(result.content).toBe("Hello world");
    expect(result.model).toBe("gpt-4");
  });
});
