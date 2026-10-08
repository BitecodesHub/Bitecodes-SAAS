import "server-only";

import type { DesktopProviderId } from "@/lib/server/db/types";
import type { ResolvedProvider } from "@/lib/server/desktop/providers";

/**
 * Inference gateway for the desktop "Bitecodes model".
 *
 * Walks the operator's provider chain (default, then fallbacks) and answers
 * from the first provider that works. Design rules, all learned the hard way
 * in the desktop app before being moved server-side:
 *
 *  - **Fallback only before the first token.** Once text has streamed to the
 *    client, switching provider would splice two different answers together,
 *    so a mid-stream failure is reported instead.
 *  - **A first-token deadline.** Free tiers (NVIDIA especially) queue requests
 *    for minutes. If another provider is waiting, a silent one is abandoned.
 *  - **Two-stage screenshots.** A vision model transcribes the image; the text
 *    model then answers from the transcript. Small vision models read well and
 *    reason badly — measured: one confidently solved a different problem.
 *  - **Reasoning text is never forwarded.** Only `content` reaches the user.
 */

export const FIRST_TOKEN_DEADLINE_MS = 30_000;
const IDLE_TIMEOUT_MS = 90_000;
export const DEFAULT_MAX_TOKENS = 4096;
const MAX_TRANSCRIPT_CHARS = 24_000;

export type FetchLike = typeof fetch;

export interface Attempt {
  provider: DesktopProviderId;
  model: string;
  outcome: string;
}

export interface DesktopCompletion {
  text: string;
  provider: DesktopProviderId;
  model: string;
  attempted: Attempt[];
  usage: { promptTokens: number | null; completionTokens: number | null };
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly attempted: Attempt[],
    readonly code:
      | "NOT_CONFIGURED"
      | "ALL_FAILED"
      | "CANCELLED"
      | "STREAM_BROKEN",
  ) {
    super(message);
  }
}

interface CallInput {
  provider: ResolvedProvider;
  model: string;
  prompt: string;
  images: string[];
  maxTokens: number;
  temperature: number;
  onToken?: (delta: string) => void;
  signal: AbortSignal;
  fetchImpl: FetchLike;
}

interface CallResult {
  text: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

function imageMime(base64: string): string {
  const head = Buffer.from(base64.slice(0, 24), "base64");
  if (head[0] === 0x89 && head[1] === 0x50) return "image/png";
  if (head[0] === 0x47 && head[1] === 0x49) return "image/gif";
  if (head.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "image/jpeg";
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const p = JSON.parse(body);
    return String(
      p?.error?.message ?? p?.message ?? p?.Message ?? p?.detail ?? body,
    ).slice(0, 300);
  } catch {
    return body.slice(0, 300) || res.statusText;
  }
}

/** OpenAI-compatible streaming (NVIDIA, OpenRouter, Groq). */
async function callOpenAICompatible(input: CallInput): Promise<CallResult> {
  const { provider } = input;
  const isOpenRouter = /openrouter\.ai/i.test(provider.baseUrl ?? "");
  const content =
    input.images.length > 0
      ? [
          { type: "text", text: input.prompt },
          ...input.images.map((img) => ({
            type: "image_url",
            image_url: { url: `data:${imageMime(img)};base64,${img}` },
          })),
        ]
      : input.prompt;

  const res = await input.fetchImpl(
    `${(provider.baseUrl ?? "").replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        // NVIDIA answers 404 for streaming requests without this header.
        Accept: "text/event-stream",
        ...(isOpenRouter
          ? {
              "HTTP-Referer": "https://bitecodes.com",
              "X-Title": "Bitecodes Desktop",
            }
          : {}),
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content }],
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        ...(isOpenRouter
          ? { provider: { data_collection: "deny", allow_fallbacks: true } }
          : {}),
      }),
      signal: input.signal,
      cache: "no-store",
    },
  );
  if (!res.ok || !res.body)
    throw new Error(`HTTP ${res.status}: ${await errorText(res)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let parsed: {
          error?: { message?: string };
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          choices?: { delta?: { content?: string | null } }[];
        };
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        if (parsed?.error)
          throw new Error(
            `stream error: ${parsed.error.message ?? "provider error"}`,
          );
        if (parsed?.usage) {
          promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
          completionTokens = parsed.usage.completion_tokens ?? completionTokens;
        }
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          text += delta;
          input.onToken?.(delta);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!text.trim())
    throw new Error(
      "empty answer (the model may have spent its budget reasoning)",
    );
  return { text, promptTokens, completionTokens };
}

/** Amazon Bedrock Converse (bearer API key). Non-streaming; emitted whole. */
async function callBedrock(input: CallInput): Promise<CallResult> {
  const { provider } = input;
  const region = provider.region ?? "ap-southeast-2";
  const content: unknown[] = input.images.map((img) => ({
    image: { format: imageMime(img).split("/")[1], source: { bytes: img } },
  }));
  content.push({ text: input.prompt });
  const res = await input.fetchImpl(
    `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(input.model)}/converse`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content }],
        inferenceConfig: {
          maxTokens: input.maxTokens,
          temperature: Math.min(Math.max(input.temperature, 0), 1),
        },
      }),
      signal: input.signal,
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await errorText(res)}`);
  const data = (await res.json()) as {
    output?: { message?: { content?: { text?: unknown }[] } };
    stopReason?: string;
    usage?: { inputTokens?: number; outputTokens?: number };
  };
  const text = (data?.output?.message?.content ?? [])
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("");
  if (!text.trim())
    throw new Error(
      `empty answer (stopReason ${data?.stopReason ?? "unknown"})`,
    );
  input.onToken?.(text);
  return {
    text,
    promptTokens: data?.usage?.inputTokens ?? null,
    completionTokens: data?.usage?.outputTokens ?? null,
  };
}

function callProvider(input: CallInput): Promise<CallResult> {
  return input.provider.id === "bedrock"
    ? callBedrock(input)
    : callOpenAICompatible(input);
}

// ---------------------------------------------------------------------------
// Chain walking
// ---------------------------------------------------------------------------

export interface RunOptions {
  prompt: string;
  images?: string[];
  maxTokens?: number;
  temperature?: number;
  onToken?: (delta: string) => void;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  /** Overridable for tests. */
  firstTokenDeadlineMs?: number;
}

/**
 * One pass over the chain for a single prompt. `pickModel` chooses the model
 * per provider (text vs vision) and may return "" to skip a provider.
 */
async function runChain(
  chain: ResolvedProvider[],
  pickModel: (p: ResolvedProvider) => string,
  opts: RunOptions & { images: string[]; stream: boolean },
  attempted: Attempt[],
): Promise<DesktopCompletion> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const deadlineMs = opts.firstTokenDeadlineMs ?? FIRST_TOKEN_DEADLINE_MS;
  const candidates = chain.filter((p) => pickModel(p));

  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i];
    const model = pickModel(provider);
    if (opts.signal?.aborted)
      throw new GatewayError("Request cancelled.", attempted, "CANCELLED");

    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    let started = false;
    let deadlineHit = false;
    const hasNext = i < candidates.length - 1;
    // First-token deadline only when there is somewhere else to go.
    const deadline = hasNext
      ? setTimeout(() => {
          if (!started) {
            deadlineHit = true;
            ctl.abort();
          }
        }, deadlineMs)
      : undefined;
    let idle = setTimeout(() => ctl.abort(), IDLE_TIMEOUT_MS);

    try {
      const result = await callProvider({
        provider,
        model,
        prompt: opts.prompt,
        images: opts.images,
        maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature ?? 0.2,
        signal: ctl.signal,
        fetchImpl,
        onToken: (delta) => {
          started = true;
          if (deadline) clearTimeout(deadline);
          clearTimeout(idle);
          idle = setTimeout(() => ctl.abort(), IDLE_TIMEOUT_MS);
          if (opts.stream) opts.onToken?.(delta);
        },
      });
      attempted.push({ provider: provider.id, model, outcome: "ok" });
      return {
        text: result.text,
        provider: provider.id,
        model,
        attempted,
        usage: {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
        },
      };
    } catch (err) {
      if (opts.signal?.aborted)
        throw new GatewayError("Request cancelled.", attempted, "CANCELLED");
      const message = deadlineHit
        ? `no response within ${Math.round(deadlineMs / 1000)}s`
        : err instanceof Error
          ? err.message
          : String(err);
      attempted.push({
        provider: provider.id,
        model,
        outcome: message.slice(0, 300),
      });
      // Text already reached the user: switching provider would splice answers.
      if (started && opts.stream) {
        throw new GatewayError(
          "The answer was cut short.",
          attempted,
          "STREAM_BROKEN",
        );
      }
    } finally {
      if (deadline) clearTimeout(deadline);
      clearTimeout(idle);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw new GatewayError(
    "All configured providers failed.",
    attempted,
    "ALL_FAILED",
  );
}

const TRANSCRIBE_PROMPT = `Transcribe the meaningful content of this screenshot exactly, character for character.
Include: any question or problem statement (with its title), all options/choices, constraints, examples with inputs and outputs, tables, formulas, and any code (keep indentation and exact signatures).
Ignore browser chrome, menus and toolbars. Do NOT solve or explain anything. Output only the transcription.`;

function isUsableTranscript(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  return !/(not able|unable|can(?:no|')t) (?:to )?(?:view|see|read|process) (?:the )?images?/i.test(
    t.slice(0, 300),
  );
}

/**
 * Answer a desktop request through the operator's chain.
 * Text-only: one pass over the chain with each provider's text model.
 * With images: transcribe (vision models), then solve (text models) — falling
 * back to sending the image directly if no transcript could be produced.
 */
export async function runDesktopCompletion(
  chain: ResolvedProvider[],
  opts: RunOptions,
): Promise<
  DesktopCompletion & {
    transcribedBy?: { provider: DesktopProviderId; model: string };
  }
> {
  if (chain.length === 0) {
    throw new GatewayError(
      "The Bitecodes model is not configured.",
      [],
      "NOT_CONFIGURED",
    );
  }
  const images = opts.images ?? [];
  const attempted: Attempt[] = [];

  if (images.length === 0) {
    return runChain(
      chain,
      (p) => p.model,
      { ...opts, images: [], stream: true },
      attempted,
    );
  }

  let transcript: DesktopCompletion | null = null;
  try {
    transcript = await runChain(
      chain,
      (p) => p.visionModel,
      {
        ...opts,
        prompt: TRANSCRIBE_PROMPT,
        images,
        stream: false,
        temperature: 0,
      },
      attempted,
    );
  } catch (err) {
    if (err instanceof GatewayError && err.code === "CANCELLED") throw err;
  }

  if (transcript && isUsableTranscript(transcript.text)) {
    const solvePrompt = `${opts.prompt}

You cannot see the screenshot directly. It has been transcribed exactly below; base your answer ONLY on it. If it is a programming problem and constraints are not shown, assume the largest usual constraints and use the asymptotically optimal algorithm. Keep the exact function signature shown.

<<<SCREENSHOT
${transcript.text.trim().slice(0, MAX_TRANSCRIPT_CHARS)}
SCREENSHOT>>>`;
    const answer = await runChain(
      chain,
      (p) => p.model,
      { ...opts, prompt: solvePrompt, images: [], stream: true },
      attempted,
    );
    return {
      ...answer,
      transcribedBy: { provider: transcript.provider, model: transcript.model },
    };
  }

  // No transcript: let a vision model answer directly.
  return runChain(
    chain,
    (p) => p.visionModel,
    { ...opts, images, stream: true },
    attempted,
  );
}
