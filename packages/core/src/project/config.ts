import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";

export const LLMConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export const SecretsSchema = z.object({
  llm: LLMConfigSchema.optional(),
});

export type Secrets = z.infer<typeof SecretsSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export interface ResolvedLLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export async function loadSecrets(projectRoot: string): Promise<Secrets> {
  const secretsPath = path.join(projectRoot, ".yanstory", "secrets.json");
  try {
    const raw = await fs.readFile(secretsPath, "utf-8");
    return SecretsSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveSecrets(projectRoot: string, secrets: Secrets): Promise<void> {
  const secretsPath = path.join(projectRoot, ".yanstory", "secrets.json");
  await fs.mkdir(path.dirname(secretsPath), { recursive: true });
  await fs.writeFile(secretsPath, JSON.stringify(secrets, null, 2));
}

export async function getDisplayConfig(projectRoot: string): Promise<ResolvedLLMConfig> {
  const secrets = await loadSecrets(projectRoot);
  const config = resolveLLMConfig(secrets);
  return {
    ...config,
    apiKey: maskApiKey(config.apiKey),
  };
}

export async function setConfigValue(
  projectRoot: string,
  key: string,
  value: string
): Promise<void> {
  const parts = key.split(".");
  if (parts.length !== 2 || parts[0] !== "llm") {
    throw new Error(`Unsupported config key: ${key}. Only llm.<apiKey|baseUrl|model> is supported.`);
  }
  const field = parts[1];
  if (!["apiKey", "baseUrl", "model"].includes(field)) {
    throw new Error(`Unsupported config key: ${key}. Only llm.<apiKey|baseUrl|model> is supported.`);
  }

  const secrets = await loadSecrets(projectRoot);
  const updated: Secrets = {
    ...secrets,
    llm: {
      ...secrets.llm,
      [field]: value,
    },
  };
  await saveSecrets(projectRoot, updated);
}

function maskApiKey(apiKey: string): string {
  if (!apiKey) return "(not set)";
  if (apiKey.length <= 4) return "****";
  return `****${apiKey.slice(-4)}`;
}

export function resolveLLMConfig(secrets: Secrets, env: NodeJS.ProcessEnv = process.env): ResolvedLLMConfig {
  return {
    apiKey: env.YANSTORY_LLM_API_KEY ?? secrets.llm?.apiKey ?? "",
    baseUrl: env.YANSTORY_LLM_BASE_URL ?? secrets.llm?.baseUrl ?? "https://api.openai.com/v1",
    model: env.YANSTORY_LLM_MODEL ?? secrets.llm?.model ?? "gpt-4o-mini",
  };
}
