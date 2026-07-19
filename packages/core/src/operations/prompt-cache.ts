export interface PromptCacheEntry {
  version: string;
  prompt: string;
}

export interface PromptCacheKey {
  operation: string;
  options: Record<string, unknown>;
}

export class PromptCache {
  private readonly entries = new Map<string, PromptCacheEntry>();

  get(key: PromptCacheKey, version: string): string | undefined {
    const entry = this.entries.get(this.serialize(key));
    if (entry && entry.version === version) return entry.prompt;
    return undefined;
  }

  async compile(
    key: PromptCacheKey,
    version: string,
    builder: () => Promise<string>
  ): Promise<string> {
    const cached = this.get(key, version);
    if (cached !== undefined) return cached;

    const prompt = await builder();
    this.set(key, version, prompt);
    return prompt;
  }

  clear(): void {
    this.entries.clear();
  }

  private set(key: PromptCacheKey, version: string, prompt: string): void {
    for (const [serialized, entry] of this.entries) {
      if (entry.version !== version) this.entries.delete(serialized);
    }
    this.entries.set(this.serialize(key), { version, prompt });
  }

  private serialize(key: PromptCacheKey): string {
    return JSON.stringify(key);
  }
}
