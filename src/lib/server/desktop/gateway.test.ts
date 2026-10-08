import { describe, expect, it, vi } from "vitest";
import {
  runDesktopCompletion,
  GatewayError,
} from "@/lib/server/desktop/gateway";
import type { ResolvedProvider } from "@/lib/server/desktop/providers";

const nvidia: ResolvedProvider = {
  id: "nvidia",
  apiKey: "nv",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  region: null,
  model: "nv-text",
  visionModel: "nv-vision",
};
const openrouter: ResolvedProvider = {
  id: "openrouter",
  apiKey: "or",
  baseUrl: "https://openrouter.ai/api/v1",
  region: null,
  model: "or-text",
  visionModel: "",
};
const bedrock: ResolvedProvider = {
  id: "bedrock",
  apiKey: "bd",
  baseUrl: null,
  region: "ap-southeast-2",
  model: "amazon.nova-lite-v1:0",
  visionModel: "amazon.nova-lite-v1:0",
};

const sse = (chunks: string[]) => {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const x of chunks) c.enqueue(enc.encode(x));
        c.close();
      },
    }),
    { status: 200 },
  );
};
const textStream = (text: string, usage = true) =>
  sse([
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "thinking" } }] })}\n\n`,
    ...text
      .split("")
      .map(
        (ch) =>
          `data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`,
      ),
    ...(usage
      ? [
          `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 3 } })}\n\n`,
        ]
      : []),
    "data: [DONE]\n\n",
  ]);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const bodyOf = (call: unknown[]) =>
  JSON.parse((call[1] as RequestInit).body as string);

describe("runDesktopCompletion — text", () => {
  it("answers from the default provider, streams only content, reports usage", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textStream("pong"));
    const tokens: string[] = [];
    const out = await runDesktopCompletion([openrouter, nvidia], {
      prompt: "hi",
      onToken: (t) => tokens.push(t),
      fetchImpl,
    });
    expect(out.text).toBe("pong");
    expect(tokens.join("")).toBe("pong"); // reasoning never forwarded
    expect(out.provider).toBe("openrouter");
    expect(out.usage).toEqual({ promptTokens: 11, completionTokens: 3 });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer or");
    expect(headers.Accept).toBe("text/event-stream");
  });

  it("falls back to the next provider when the default fails before any token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(410, { detail: "model reached end of life" }))
      .mockResolvedValueOnce(textStream("ok"));
    const out = await runDesktopCompletion([nvidia, openrouter], {
      prompt: "hi",
      fetchImpl,
    });
    expect(out.provider).toBe("openrouter");
    expect(
      out.attempted.map((a) => [
        a.provider,
        a.outcome.startsWith("HTTP 410") || a.outcome === "ok",
      ]),
    ).toEqual([
      ["nvidia", true],
      ["openrouter", true],
    ]);
  });

  it("treats an empty (reasoning-only) answer as a failure and falls back", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        sse([
          `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "..." } }] })}\n\n`,
          "data: [DONE]\n\n",
        ]),
      )
      .mockResolvedValueOnce(textStream("answer"));
    const out = await runDesktopCompletion([nvidia, openrouter], {
      prompt: "x",
      fetchImpl,
    });
    expect(out.text).toBe("answer");
    expect(out.attempted[0].outcome).toMatch(/empty answer/);
  });

  it("abandons a silent provider at the first-token deadline when another is waiting", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation((url: string, init: RequestInit) => {
        if (String(url).includes("nvidia")) {
          return new Promise((_, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          );
        }
        return Promise.resolve(textStream("fast"));
      });
    const out = await runDesktopCompletion([nvidia, openrouter], {
      prompt: "x",
      fetchImpl,
      firstTokenDeadlineMs: 50,
    });
    expect(out.provider).toBe("openrouter");
    expect(out.attempted[0].outcome).toMatch(/no response within/);
  });

  it("does not splice answers: a mid-stream failure is reported, not retried", async () => {
    const enc = new TextEncoder();
    let reads = 0;
    const broken = new Response(
      new ReadableStream({
        // First read delivers a token; the next one fails, like a dropped socket.
        pull(c) {
          if (reads++ === 0)
            c.enqueue(
              enc.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "par" } }] })}\n\n`,
              ),
            );
          else c.error(new Error("socket reset"));
        },
      }),
      { status: 200 },
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce(textStream("other"));
    await expect(
      runDesktopCompletion([nvidia, openrouter], { prompt: "x", fetchImpl }),
    ).rejects.toMatchObject({ code: "STREAM_BROKEN" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports ALL_FAILED with every attempt, and NOT_CONFIGURED for an empty chain", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json(401, { error: { message: "bad key" } }));
    const err = await runDesktopCompletion([nvidia, openrouter], {
      prompt: "x",
      fetchImpl,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(GatewayError);
    expect(err.code).toBe("ALL_FAILED");
    expect(err.attempted).toHaveLength(2);
    await expect(
      runDesktopCompletion([], { prompt: "x" }),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });

  it("calls Bedrock Converse with bearer auth and returns its text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json(200, {
        output: { message: { content: [{ text: "from bedrock" }] } },
        usage: { inputTokens: 5, outputTokens: 2 },
      }),
    );
    const tokens: string[] = [];
    const out = await runDesktopCompletion([bedrock], {
      prompt: "hi",
      onToken: (t) => tokens.push(t),
      fetchImpl,
    });
    expect(out.text).toBe("from bedrock");
    expect(tokens).toEqual(["from bedrock"]);
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/amazon.nova-lite-v1%3A0/converse",
    );
    expect(bodyOf(fetchImpl.mock.calls[0]).inferenceConfig.maxTokens).toBe(
      4096,
    );
  });
});

describe("runDesktopCompletion — screenshots", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).toString(
    "base64",
  );

  it("transcribes with a vision model, then solves with a text model from the transcript", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        textStream(
          "Problem 3266: Final Array State After K Multiplication Operations II ... examples ...",
        ),
      )
      .mockResolvedValueOnce(textStream("class Solution {}"));
    const tokens: string[] = [];
    const out = await runDesktopCompletion([openrouter, nvidia], {
      prompt: "Solve it",
      images: [png],
      onToken: (t) => tokens.push(t),
      fetchImpl,
    });
    // Stage 1: openrouter has no vision model, so nvidia's vision model reads it.
    const first = bodyOf(fetchImpl.mock.calls[0]);
    expect(first.model).toBe("nv-vision");
    expect(first.messages[0].content[1].image_url.url).toMatch(
      /^data:image\/png;base64,/,
    );
    // Stage 2: the default provider's TEXT model answers, with no image.
    const second = bodyOf(fetchImpl.mock.calls[1]);
    expect(second.model).toBe("or-text");
    expect(typeof second.messages[0].content).toBe("string");
    expect(second.messages[0].content).toContain("Problem 3266");
    expect(out.text).toBe("class Solution {}");
    expect(tokens.join("")).toBe("class Solution {}"); // transcript never streamed to the user
    expect(out.transcribedBy).toEqual({
      provider: "nvidia",
      model: "nv-vision",
    });
  });

  it("falls back to sending the image directly when the reader refuses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        textStream("I'm not able to view images, please type it."),
      )
      .mockResolvedValueOnce(textStream("direct answer"));
    const out = await runDesktopCompletion([nvidia], {
      prompt: "Solve",
      images: [png],
      fetchImpl,
    });
    expect(out.text).toBe("direct answer");
    expect(bodyOf(fetchImpl.mock.calls[1]).model).toBe("nv-vision");
  });
});
