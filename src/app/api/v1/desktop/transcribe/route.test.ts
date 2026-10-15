import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { createTestUser } from "@/test/desktop";

process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-chars-long-xx";

describeWithDatabase("POST /api/v1/desktop/transcribe", () => {
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
      c.desktopUsageDaily,
    ])
      await (await col()).deleteMany({});
  });

  async function token() {
    const d = await import("@/lib/server/desktop/devices");
    const p = await d.startPairing({ label: "Notes on Windows" });
    await d.decidePairing({
      userCode: p.userCode,
      userId: await createTestUser(),
      approve: true,
    });
    return ((await d.pollPairing(p.deviceCode)) as { token: string }).token;
  }
  const audio = Buffer.alloc(4000, 7).toString("base64");
  const call = async (t: string | null, body: unknown) => {
    const { POST } = await import("@/app/api/v1/desktop/transcribe/route");
    return POST(
      new Request("http://localhost/api/v1/desktop/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  };

  it("requires a signed-in device", async () => {
    expect((await call(null, { audio, mimeType: "audio/webm" })).status).toBe(
      401,
    );
  });

  it("transcribes via Groq Whisper, sending the recording as multipart, and logs the transcript", async () => {
    const p = await import("@/lib/server/desktop/providers");
    await p.upsertProvider("groq", { enabled: true, apiKey: "gsk-test" });
    await p.setRouting({
      enabled: true,
      defaultProvider: "groq",
      fallback: [],
    });
    const t = await token();
    const upstream = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: " hello world " }), {
          status: 200,
        }),
    );
    globalThis.fetch = upstream as unknown as typeof fetch;

    const res = await call(t, { audio, mimeType: "audio/webm;codecs=opus" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, text: "hello world" });

    const [url, init] = upstream.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer gsk-test",
    );
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect((form.get("file") as File).name).toBe("recording.webm");

    const { desktopPromptLog } = await import("@/lib/server/db/collections");
    const log = await (await desktopPromptLog()).findOne({});
    expect(log).toMatchObject({
      kind: "audio",
      status: "ok",
      provider: "groq",
      response: "hello world",
    });
    expect(log?.prompt).toMatch(/voice recording/); // the audio itself is never stored
  });

  it("rejects unknown formats and tiny recordings, and says when no Groq provider exists", async () => {
    const t = await token();
    expect((await call(t, { audio, mimeType: "video/mp4" })).status).toBe(422);
    expect(
      (await call(t, { audio: "AAAA", mimeType: "audio/webm" })).status,
    ).toBe(422);
    const res = await call(t, { audio, mimeType: "audio/webm" });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("NOT_CONFIGURED");
  });
});
