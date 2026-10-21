import { beforeAll, beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

beforeAll(() => {
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-chars-long-xx";
});

describeWithDatabase("desktop provider config", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { desktopProviders } = await import("@/lib/server/db/collections");
    await (await desktopProviders()).deleteMany({});
  });

  it("defaults to an enabled integration (site key fallback) with redacted provider views", async () => {
    const { listProviderViews, getRouting } =
      await import("@/lib/server/desktop/providers");
    const views = await listProviderViews();
    expect(views.map((v) => v.id)).toEqual([
      "nvidia",
      "openrouter",
      "groq",
      "bedrock",
    ]);
    expect(views.every((v) => !v.enabled && !v.hasKey)).toBe(true);
    // Defaults still surface so the admin form is pre-filled.
    expect(views[0].baseUrl).toContain("nvidia.com");
    // On by default: with no desktop provider configured, the site's own AI
    // key answers (platformFallback), so a fresh deploy works out of the box.
    const routing = await getRouting();
    expect(routing.enabled).toBe(true);
  });

  it("stores the API key encrypted, never in plaintext, and shows only a hint", async () => {
    const { upsertProvider, listProviderViews } =
      await import("@/lib/server/desktop/providers");
    const { desktopProviders } = await import("@/lib/server/db/collections");
    await upsertProvider("nvidia", {
      enabled: true,
      apiKey: "nvapi-secret-9999",
    });

    const raw = await (await desktopProviders()).findOne({ _id: "nvidia" });
    expect(JSON.stringify(raw)).not.toContain("nvapi-secret-9999");
    expect((raw as { apiKeyCipher?: string }).apiKeyCipher).toMatch(/^v1\./);

    const view = (await listProviderViews()).find((v) => v.id === "nvidia")!;
    expect(view.enabled).toBe(true);
    expect(view.hasKey).toBe(true);
    expect(view.apiKeyHint).toBe("9999");
  });

  it("keeps the stored key when apiKey is omitted, clears it when blank", async () => {
    const { upsertProvider, resolveDesktopChain, setRouting } =
      await import("@/lib/server/desktop/providers");
    await upsertProvider("openrouter", { enabled: true, apiKey: "sk-or-keep" });
    await upsertProvider("openrouter", { model: "x/y" }); // no apiKey field
    await setRouting({
      enabled: true,
      defaultProvider: "openrouter",
      fallback: [],
    });

    let chain = await resolveDesktopChain();
    expect(chain[0].apiKey).toBe("sk-or-keep"); // decrypted, still present
    expect(chain[0].model).toBe("x/y");

    await upsertProvider("openrouter", { apiKey: "" }); // explicit clear
    chain = await resolveDesktopChain();
    expect(chain).toHaveLength(0); // keyless provider is dropped
  });

  it("resolves the chain in default-then-fallback order, skipping unusable providers", async () => {
    const { upsertProvider, setRouting, resolveDesktopChain } =
      await import("@/lib/server/desktop/providers");
    await upsertProvider("nvidia", { enabled: true, apiKey: "nv" });
    await upsertProvider("openrouter", { enabled: true, apiKey: "or" });
    await upsertProvider("bedrock", { enabled: false, apiKey: "bd" }); // disabled
    await setRouting({
      enabled: true,
      defaultProvider: "openrouter",
      fallback: ["bedrock", "nvidia"],
    });

    const chain = await resolveDesktopChain();
    // openrouter first; bedrock skipped (disabled); nvidia last.
    expect(chain.map((c) => c.id)).toEqual(["openrouter", "nvidia"]);
    expect(chain.map((c) => c.apiKey)).toEqual(["or", "nv"]);
  });

  it("returns an empty chain when the integration is disabled", async () => {
    const { upsertProvider, setRouting, resolveDesktopChain } =
      await import("@/lib/server/desktop/providers");
    await upsertProvider("nvidia", { enabled: true, apiKey: "nv" });
    await setRouting({
      enabled: false,
      defaultProvider: "nvidia",
      fallback: [],
    });
    expect(await resolveDesktopChain()).toEqual([]);
  });

  it("resolves Groq as an OpenAI-compatible link with its verified defaults", async () => {
    const { upsertProvider, setRouting, resolveDesktopChain } =
      await import("@/lib/server/desktop/providers");
    await upsertProvider("groq", { enabled: true, apiKey: "gsk_test_1234" });
    await setRouting({ enabled: true, defaultProvider: "groq", fallback: [] });
    const [link] = await resolveDesktopChain();
    expect(link).toMatchObject({
      id: "groq",
      apiKey: "gsk_test_1234",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-120b",
      visionModel: "qwen/qwen3.8-27b",
    });
  });

  it("automation chain uses the same providers and order, ignoring the desktop switch", async () => {
    const {
      upsertProvider,
      setRouting,
      resolveDesktopChain,
      resolveAutomationChain,
    } = await import("@/lib/server/desktop/providers");
    await upsertProvider("nvidia", { enabled: true, apiKey: "nv" });
    await upsertProvider("groq", { enabled: true, apiKey: "gq" });
    await upsertProvider("bedrock", { enabled: false, apiKey: "bd" });
    await setRouting({
      enabled: true,
      defaultProvider: "groq",
      fallback: ["bedrock", "nvidia"],
    });

    const desktop = await resolveDesktopChain();
    const automation = await resolveAutomationChain();
    expect(automation.map((c) => c.id)).toEqual(["groq", "nvidia"]);
    expect(automation).toEqual(desktop);

    // Desktop switched off: the desktop app gets nothing, automations still run.
    await setRouting({
      enabled: false,
      defaultProvider: "groq",
      fallback: ["bedrock", "nvidia"],
    });
    expect(await resolveDesktopChain()).toEqual([]);
    expect((await resolveAutomationChain()).map((c) => c.id)).toEqual([
      "groq",
      "nvidia",
    ]);
  });

  it("automation chain appends the platform key last, even with the desktop switch off", async () => {
    const { setRouting, resolveAutomationChain, resolveDesktopChain } =
      await import("@/lib/server/desktop/providers");
    const saved = {
      key: process.env.AI_API_KEY,
      base: process.env.AI_BASE_URL,
    };
    process.env.AI_API_KEY = "platform-key";
    process.env.AI_BASE_URL = "https://api.groq.com/openai/v1";
    try {
      await setRouting({
        enabled: false,
        defaultProvider: "nvidia",
        fallback: [],
      });
      expect(await resolveDesktopChain()).toEqual([]);
      const chain = await resolveAutomationChain();
      expect(chain).toHaveLength(1);
      expect(chain[0]).toMatchObject({ id: "groq", apiKey: "platform-key" });
    } finally {
      if (saved.key === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = saved.key;
      if (saved.base === undefined) delete process.env.AI_BASE_URL;
      else process.env.AI_BASE_URL = saved.base;
    }
  });

  it("automation chain keeps AI_MODEL for the platform key; the desktop chain does not", async () => {
    const { setRouting, resolveAutomationChain, resolveDesktopChain } =
      await import("@/lib/server/desktop/providers");
    const saved = {
      key: process.env.AI_API_KEY,
      base: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
    };
    process.env.AI_API_KEY = "platform-key";
    process.env.AI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.AI_MODEL = "openai/gpt-oss-120b";
    try {
      await setRouting({
        enabled: true,
        defaultProvider: "nvidia",
        fallback: [],
      });
      const [automation] = await resolveAutomationChain();
      expect(automation).toMatchObject({
        id: "nvidia",
        model: "openai/gpt-oss-120b",
      });
      const [desktop] = await resolveDesktopChain();
      expect(desktop).toMatchObject({
        id: "nvidia",
        model: "openai/gpt-oss-20b",
      });
    } finally {
      for (const [name, value] of [
        ["AI_API_KEY", saved.key],
        ["AI_BASE_URL", saved.base],
        ["AI_MODEL", saved.model],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("falls back to OPENROUTER_MODEL, then the desktop default, for the automation link", async () => {
    const { automationPlatformLink, platformKeyState } =
      await import("@/lib/server/desktop/providers");
    expect(
      automationPlatformLink({
        OPENROUTER_API_KEY: "k",
        OPENROUTER_MODEL: "google/gemini-2.5-flash",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({ id: "openrouter", model: "google/gemini-2.5-flash" });
    expect(
      automationPlatformLink({
        AI_API_KEY: "k",
        AI_BASE_URL: "https://api.groq.com/openai/v1",
        AI_MODEL: " ",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({ id: "groq", model: "openai/gpt-oss-120b" });

    // A host the chain cannot call is reported, never silently dropped.
    const custom = {
      AI_API_KEY: "k",
      AI_BASE_URL: "https://api.example-llm.com/v1",
    } as unknown as NodeJS.ProcessEnv;
    expect(automationPlatformLink(custom)).toBeNull();
    expect(platformKeyState(custom)).toBe("unsupported-host");
    expect(platformKeyState({} as unknown as NodeJS.ProcessEnv)).toBe("absent");
    expect(
      platformKeyState({ AI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv),
    ).toBe("supported");
  });

  it("sanitises routing: unknown ids rejected, default never duplicated in fallback", async () => {
    const { setRouting, getRouting } =
      await import("@/lib/server/desktop/providers");
    await setRouting({
      enabled: true,
      defaultProvider: "nvidia",
      fallback: ["nvidia", "openrouter", "openrouter", "bedrock"],
    });
    const routing = await getRouting();
    expect(routing.fallback).toEqual(["openrouter", "bedrock"]);
    await expect(
      setRouting({
        enabled: true,
        defaultProvider: "bogus" as never,
        fallback: [],
      }),
    ).rejects.toThrow();
  });
});
