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
        return {
          content: rule.response,
          model: options.model ?? "stub",
          usage: {
            promptTokens: prompt.length,
            completionTokens: rule.response.length,
            totalTokens: prompt.length + rule.response.length,
          },
        };
      }
    }

    return {
      content: `[stub] No matching response for prompt: ${prompt.slice(0, 80)}...`,
      model: options.model ?? "stub",
      usage: { promptTokens: prompt.length, completionTokens: 0, totalTokens: prompt.length },
    };
  }
}

export function createLLMStub(): LLMClient {
  const stub = new LLMStub();
  return (options: ChatCompletionOptions) => stub.call(options);
}
