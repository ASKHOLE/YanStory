import type { ChatCompletionOptions, ChatCompletionResult, LLMClient } from "./client.js";

export interface StubResponse {
  pattern: RegExp;
  response: string;
}

export class LLMStub {
  private responses: StubResponse[] = [];

  when(pattern: RegExp, response: string): this {
    this.responses.push({ pattern, response });
    return this;
  }

  async call(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const lastUserMessage = [...options.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUserMessage?.content ?? "";

    for (const rule of this.responses) {
      if (rule.pattern.test(prompt)) {
        const chunks = options.stream ? rule.response.split(" ") : [rule.response];
        let content = "";
        for (const chunk of chunks) {
          content += chunk;
          options.onChunk?.(chunk);
        }
        return {
          content,
          model: options.model ?? "stub",
          usage: {
            promptTokens: prompt.length,
            completionTokens: rule.response.length,
            totalTokens: prompt.length + rule.response.length,
          },
        };
      }
    }

    const fallback = `[stub] No matching response for prompt: ${prompt.slice(0, 80)}...`;
    options.onChunk?.(fallback);
    return {
      content: fallback,
      model: options.model ?? "stub",
      usage: { promptTokens: prompt.length, completionTokens: 0, totalTokens: prompt.length },
    };
  }
}

export function createLLMStub(): LLMClient {
  const stub = new LLMStub();
  return (options: ChatCompletionOptions) => stub.call(options);
}
