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

export function createLLMClient(config: ResolvedLLMConfig): LLMClient {
  return async (options) => {
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
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${text}`);
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
  };
}

export function createLLMClientFromConfig(config: LLMConfig): LLMClient {
  const resolved: ResolvedLLMConfig = {
    apiKey: config.apiKey ?? "",
    baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
    model: config.model ?? "gpt-4o-mini",
  };
  return createLLMClient(resolved);
}
