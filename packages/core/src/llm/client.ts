import type { LLMConfig, ResolvedLLMConfig } from "../project/config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type LLMClient = (options: ChatCompletionOptions) => Promise<ChatCompletionResult>;

class LLMRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LLMRequestError";
    this.status = status;
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMRequestError) {
    return error.status === 429 || error.status >= 500;
  }
  // Network/fetch failures surface as Error instances before a response is received.
  return error instanceof Error;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 300);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

async function readSSEStream(response: Response): Promise<{ content: string; chunks: string[] }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("LLM stream response has no readable body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data) as StreamChunk;
        const chunk = parsed.choices?.[0]?.delta?.content ?? "";
        if (chunk) {
          content += chunk;
          chunks.push(chunk);
        }
      } catch {
        // Ignore malformed SSE lines.
      }
    }
  }

  return { content, chunks };
}

async function postChatCompletion(
  config: ResolvedLLMConfig,
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? config.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      stream: Boolean(options.stream),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new LLMRequestError(response.status, `LLM request failed: ${response.status} ${text}`);
  }

  if (options.stream) {
    const { content, chunks } = await readSSEStream(response);
    for (const chunk of chunks) {
      options.onChunk?.(chunk);
    }
    return {
      content,
      model: options.model ?? config.model,
    };
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  const content = data.choices[0]?.message?.content ?? "";
  return {
    content,
    model: data.model ?? config.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

export function createLLMClient(config: ResolvedLLMConfig): LLMClient {
  return (options) => withRetry(() => postChatCompletion(config, options));
}

export function createLLMClientFromConfig(config: LLMConfig): LLMClient {
  const resolved: ResolvedLLMConfig = {
    apiKey: config.apiKey ?? "",
    baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
    model: config.model ?? "gpt-4o-mini",
  };
  return createLLMClient(resolved);
}
