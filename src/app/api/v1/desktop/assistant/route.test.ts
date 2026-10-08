import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-chars-long-xx";

const sse = (text: string) => {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const ch of text)
          c.enqueue(
            enc.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`,
            ),
          );
        c.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } })}\n\ndata: [DONE]\n\n`,
          ),
        );
        c.close();
      },
    }),
    { status: 200 },
  );
};

async function readSse(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((f) => ({
      event: /event: (\w+)/.exec(f)?.[1],
      data: JSON.parse(/data: (.*)/.exec(f)?.[1] ?? "null"),
    }));
}

describeWithDatabase("POST /api/v1/desktop/assistant", () => {
  useTestDatabase();
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    const c = await import("@/lib/server/db/collections");
    for (const col of [
      c.desktopProviders,
      c.desktopTokens,
      c.desktopPromptLog,
      c.desktopEvents,
    ])
      await (await col()).deleteMany({});
    const { rateLimits } = c as unknown as {
      rateLimits?: () => Promise<{
        deleteMany: (f: object) => Promise<unknown>;
      }>;
    };
    if (rateLimits) await (await rateLimits()).deleteMany({});
  });

  async function pairedToken(userId = "507f1f77bcf86cd799439011") {
    const d = await import("@/lib/server/desktop/devices");
    const p = await d.startPairing({ label: "Notes on macOS" });
    await d.decidePairing({ userCode: p.userCode, userId, approve: true });
    return ((await d.pollPairing(p.deviceCode)) as { token: string }).token;
  }

  const call = async (
    token: string | null,
    body: unknown,
    headers: Record<string, string> = {},
  ) => {
    const { POST } = await import("@/app/api/v1/desktop/assistant/route");
    return POST(
      new Request("http://localhost/api/v1/desktop/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
  };

  it("rejects a missing or bad token", async () => {
    expect((await call(null, { prompt: "hi" })).status).toBe(401);
    expect((await call("bcd_nope", { prompt: "hi" })).status).toBe(401);
  });

  it("returns 503 when the Bitecodes model is not configured", async () => {
    const token = await pairedToken();
    expect((await call(token, { prompt: "hi" })).status).toBe(503);
  });

  it("streams the answer, hides the model from the client, and logs everything", async () => {
    const p = await import("@/lib/server/desktop/providers");
    await p.upsertProvider("nvidia", {
      enabled: true,
      apiKey: "nv-key",
      model: "secret/model-x",
    });
    await p.setRouting({
      enabled: true,
      defaultProvider: "nvidia",
      fallback: [],
    });
    const token = await pairedToken();
    const upstream = vi.fn().mockResolvedValue(sse("pong"));
    globalThis.fetch = upstream as unknown as typeof fetch;

    const res = await call(token, { prompt: "Reply with pong" });
    expect(res.status).toBe(200);
    const raw = await res.clone().text();
    const events = await readSse(res);
    expect(
      events
        .filter((e) => e.event === "token")
        .map((e) => e.data.delta)
        .join(""),
    ).toBe("pong");
    expect(events.at(-1)?.event).toBe("done");
    // The client must never learn which provider or model answered.
    expect(raw).not.toMatch(/model-x|nvidia|secret\//i);
    // The upstream key is sent to the provider, never back to the client.
    expect(raw).not.toContain("nv-key");
    expect((upstream.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer nv-key",
    });

    const { listDesktopLogs } = await import("@/lib/server/desktop/logs");
    const { rows } = await listDesktopLogs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "ok",
      provider: "nvidia",
      model: "secret/model-x",
      prompt: "Reply with pong",
      response: "pong",
      promptTokens: 7,
      completionTokens: 2,
      hadImage: false,
    });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("logs failures with every attempted provider and sends a generic error event", async () => {
    const p = await import("@/lib/server/desktop/providers");
    await p.upsertProvider("nvidia", { enabled: true, apiKey: "nv" });
    await p.upsertProvider("openrouter", { enabled: true, apiKey: "or" });
    await p.setRouting({
      enabled: true,
      defaultProvider: "nvidia",
      fallback: ["openrouter"],
    });
    const token = await pairedToken();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('{"error":{"message":"down"}}', { status: 503 }),
      ) as unknown as typeof fetch;

    const events = await readSse(await call(token, { prompt: "hi" }));
    const err = events.find((e) => e.event === "error");
    expect(err?.data.code).toBe("ALL_FAILED");
    expect(JSON.stringify(err)).not.toMatch(/nvidia|openrouter/i);

    const { rows } = await (
      await import("@/lib/server/desktop/logs")
    ).listDesktopLogs({ status: "error" });
    expect(rows[0].attempted.map((a) => a.provider)).toEqual([
      "nvidia",
      "openrouter",
    ]);
  });

  it("validates the body", async () => {
    const p = await import("@/lib/server/desktop/providers");
    await p.upsertProvider("nvidia", { enabled: true, apiKey: "nv" });
    await p.setRouting({
      enabled: true,
      defaultProvider: "nvidia",
      fallback: [],
    });
    const token = await pairedToken();
    expect((await call(token, { prompt: "" })).status).toBe(422);
    expect((await call(token, { prompt: "x".repeat(70_000) })).status).toBe(
      422,
    );
  });

  it("a revoked device is rejected immediately", async () => {
    const token = await pairedToken();
    const { revokeDesktopToken } = await import("@/lib/server/desktop/devices");
    await revokeDesktopToken(token);
    expect((await call(token, { prompt: "hi" })).status).toBe(401);
  });

  it("tracks request type, app build, hashed IP and time to first token", async () => {
    const p = await import("@/lib/server/desktop/providers");
    await p.upsertProvider("groq", { enabled: true, apiKey: "gsk-key" });
    await p.setRouting({
      enabled: true,
      defaultProvider: "groq",
      fallback: [],
    });
    const token = await pairedToken();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(sse("ok")) as unknown as typeof fetch;

    const res = await call(
      token,
      { prompt: "Solve this", kind: "solution" },
      {
        "X-Notes-Client": "Notes/1.7.0 (darwin; arm64)<script>",
        "X-Forwarded-For": "203.0.113.9",
      },
    );
    await res.text();
    const { desktopPromptLog } = await import("@/lib/server/db/collections");
    const doc = await (await desktopPromptLog()).findOne({});
    expect(doc).toMatchObject({
      kind: "solution",
      status: "ok",
      provider: "groq",
      imageCount: 0,
    });
    expect(doc?.client).toBe("Notes/1.7.0 (darwin; arm64)script"); // sanitised
    expect(doc?.ipHash).toBeTruthy();
    expect(JSON.stringify(doc)).not.toContain("203.0.113.9"); // never the raw IP
    expect(typeof doc?.ttftMs).toBe("number");
  });

  it("defaults the type from the request and records rejected tokens", async () => {
    const p = await import("@/lib/server/desktop/providers");
    await p.upsertProvider("groq", { enabled: true, apiKey: "gsk-key" });
    await p.setRouting({
      enabled: true,
      defaultProvider: "groq",
      fallback: [],
    });
    const token = await pairedToken();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(sse("ok")) as unknown as typeof fetch;
    await (
      await call(token, {
        prompt: "What is this?",
        images: ["aGVsbG8="],
        kind: "bogus",
      })
    ).text();
    const c = await import("@/lib/server/db/collections");
    expect((await (await c.desktopPromptLog()).findOne({}))?.kind).toBe(
      "screenshot",
    );

    const d = await import("@/lib/server/desktop/devices");
    await d.revokeDesktopToken(token);
    expect((await call(token, { prompt: "hi" })).status).toBe(401);
    expect(
      await (
        await c.desktopEvents()
      ).countDocuments({ type: "token_rejected" }),
    ).toBe(1);
  });
});
