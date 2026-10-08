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
