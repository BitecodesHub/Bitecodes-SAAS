import {
  recordRejectedToken,
  verifyDesktopToken,
} from "@/lib/server/desktop/devices";
import { resolveDesktopChain } from "@/lib/server/desktop/providers";
import {
  GatewayError,
  runDesktopCompletion,
  type Attempt,
} from "@/lib/server/desktop/gateway";
import { logDesktopRequest } from "@/lib/server/desktop/logs";
import {
  bearerToken,
  clientContext,
  desktopJson,
  readJsonObject,
} from "@/lib/server/desktop/http";
import type { DesktopRequestKind } from "@/lib/server/db/types";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";

/**
 * POST /api/v1/desktop/assistant — the desktop app's "Bitecodes model".
 *
 * Body: { prompt: string, images?: string[] (base64 JPEG/PNG), maxTokens?, kind? }
 * Auth: Authorization: Bearer <device token from the browser sign-in>.
 * Optional X-Notes-Client: "Notes/<version> (<os>; <arch>)" for the activity log.
 *
 * Streams Server-Sent Events: `token` {delta}, then `done` {usage} or
 * `error` {code, message}. The provider and model that answered are recorded
 * in the operator's log and deliberately never sent to the client.
 */
export const dynamic = "force-dynamic";
/** Screenshots run two model calls (read, then solve); allow headroom. */
export const maxDuration = 300;

/** Below Vercel's 4.5 MB request ceiling; the app downsizes screenshots first. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_CHARS = 60_000;
const MAX_IMAGES = 4;
const KINDS: DesktopRequestKind[] = [
  "chat",
  "screenshot",
  "solution",
  "debug",
  "other",
];

export async function POST(request: Request) {
  const started = Date.now();
  const token = bearerToken(request);
  const ctx = clientContext(request);
  const device = await verifyDesktopToken(token, new Date(), ctx);
  if (!device) {
    await recordRejectedToken(token, ctx);
    return desktopJson(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Sign in to Bitecodes again.",
      },
      401,
    );
  }

  const limit = await consumeNamedRateLimit("desktopAssistant", device.userId);
  if (!limit.allowed) {
    return desktopJson(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many requests just now. Please wait a moment.",
      },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const body = await readJsonObject(request, MAX_BODY_BYTES);
  if (!body) {
    return desktopJson(
      {
        ok: false,
        code: "INVALID",
        message: "Request is too large or not valid JSON.",
      },
      413,
    );
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const images = Array.isArray(body.images)
    ? body.images
        .filter(
          (i): i is string =>
            typeof i === "string" && /^[A-Za-z0-9+/=_-]+$/.test(i),
        )
        .slice(0, MAX_IMAGES)
    : [];
  const maxTokens =
    typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)
      ? Math.min(Math.max(Math.round(body.maxTokens), 64), 16_384)
      : undefined;
  const kind: DesktopRequestKind = KINDS.includes(
    body.kind as DesktopRequestKind,
  )
    ? (body.kind as DesktopRequestKind)
    : images.length > 0
      ? "screenshot"
      : "chat";
  // Shared by every log write below.
  const meta = {
    userId: device.userId,
    tokenId: device.tokenId,
    hadImage: images.length > 0,
    imageCount: images.length,
    kind,
    client: ctx.client,
    ipHash: ctx.ipHash,
  };
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    return desktopJson(
      { ok: false, code: "INVALID", message: "Prompt is empty or too long." },
      422,
    );
  }

  const chain = await resolveDesktopChain();
  if (chain.length === 0) {
    await logDesktopRequest({
      ...meta,
      provider: null,
      model: null,
      attempted: [],
      ttftMs: null,
      prompt,
      response: "",
      status: "error",
      error: "not configured",
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
    });
    return desktopJson(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        message: "The Bitecodes model is not available right now.",
      },
      503,
    );
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal?.addEventListener("abort", () => abort.abort(), {
    once: true,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };
      let streamed = "";
      let firstTokenAt: number | null = null;
      let attempted: Attempt[] = [];
      try {
        const result = await runDesktopCompletion(chain, {
          prompt,
          images,
          maxTokens,
          signal: abort.signal,
          onToken: (delta) => {
            if (firstTokenAt === null) firstTokenAt = Date.now();
            streamed += delta;
            send("token", { delta });
          },
        });
        attempted = result.attempted;
        send("done", {
          usage: {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
          },
        });
        await logDesktopRequest({
          ...meta,
          provider: result.provider,
          model: result.model,
          attempted,
          ttftMs: firstTokenAt === null ? null : firstTokenAt - started,
          prompt,
          response: result.text,
          status: "ok",
          error: null,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        const ge = error instanceof GatewayError ? error : null;
        attempted = ge?.attempted ?? attempted;
        const code = ge?.code ?? "UPSTREAM_ERROR";
        const message =
          code === "CANCELLED"
            ? "Cancelled."
            : code === "STREAM_BROKEN"
              ? "The answer was cut short. Please try again."
              : "The Bitecodes model could not answer just now. Please try again.";
        send("error", { code, message });
        await logDesktopRequest({
          ...meta,
          provider: null,
          model: null,
          attempted,
          ttftMs: firstTokenAt === null ? null : firstTokenAt - started,
          prompt,
          response: streamed,
          // A user stopping the answer (or closing the app) is not a failure.
          status:
            code === "CANCELLED" || abort.signal.aborted
              ? "cancelled"
              : "error",
          error: error instanceof Error ? error.message : String(error),
          promptTokens: null,
          completionTokens: null,
          latencyMs: Date.now() - started,
        });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* client already gone */
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
