import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  loadSecrets,
  saveSecrets,
  resolveLLMConfig,
  setConfigValue,
  getDisplayConfig,
} from "../config.js";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "yanstory-config-test-"));
}

describe("config", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await createTempDir();
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("loads empty secrets when file does not exist", async () => {
    const secrets = await loadSecrets(projectRoot);
    expect(secrets).toEqual({});
  });

  it("saves and loads secrets", async () => {
    await saveSecrets(projectRoot, { llm: { model: "gpt-4o", apiKey: "sk-123" } });
    const secrets = await loadSecrets(projectRoot);
    expect(secrets.llm?.model).toBe("gpt-4o");
    expect(secrets.llm?.apiKey).toBe("sk-123");
  });

  it("resolves config from env with fallback to secrets", () => {
    const secrets = { llm: { model: "gpt-4o", baseUrl: "https://example.com/v1" } };
    const env = { YANSTORY_LLM_MODEL: "env-model" };
    const config = resolveLLMConfig(secrets, env);
    expect(config.model).toBe("env-model");
    expect(config.baseUrl).toBe("https://example.com/v1");
    expect(config.apiKey).toBe("");
  });

  it("sets a config value and persists it", async () => {
    await setConfigValue(projectRoot, "llm.model", "gpt-4o-mini");
    const secrets = await loadSecrets(projectRoot);
    expect(secrets.llm?.model).toBe("gpt-4o-mini");
  });

  it("merges config values without overwriting others", async () => {
    await saveSecrets(projectRoot, { llm: { apiKey: "sk-abc" } });
    await setConfigValue(projectRoot, "llm.model", "gpt-4o");
    const secrets = await loadSecrets(projectRoot);
    expect(secrets.llm?.apiKey).toBe("sk-abc");
    expect(secrets.llm?.model).toBe("gpt-4o");
  });

  it("rejects unsupported config keys", async () => {
    await expect(setConfigValue(projectRoot, "foo.bar", "x")).rejects.toThrow("Unsupported config key");
    await expect(setConfigValue(projectRoot, "llm.unknown", "x")).rejects.toThrow("Unsupported config key");
  });

  it("masks api key in display config", async () => {
    await saveSecrets(projectRoot, { llm: { apiKey: "sk-verysecretkey" } });
    const config = await getDisplayConfig(projectRoot);
    expect(config.apiKey).toContain("****");
    expect(config.apiKey).not.toContain("verysecretkey");
  });

  it("shows not set when api key is empty", async () => {
    const config = await getDisplayConfig(projectRoot);
    expect(config.apiKey).toBe("(not set)");
  });
});
