import {
  recordRejectedToken,
  verifyDesktopToken,
} from "@/lib/server/desktop/devices";
import { resolveDesktopChain } from "@/lib/server/desktop/providers";
import { logDesktopRequest } from "@/lib/server/desktop/logs";
import { admitRequest, recordTokens } from "@/lib/server/desktop/quota";
import {
  bearerToken,
  clientContext,
  desktopJson,
  readJsonObject,
  withDesktopErrors,
} from "@/lib/server/desktop/http";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";

/**
 * POST /api/v1/desktop/transcribe — speech-to-text for the desktop app's
 * Record button. Body: { audio: base64, mimeType }. Returns { text }.
 *
 * Done server-side (Groq's hosted Whisper) so voice works on every computer
 * without bundling whisper.cpp, ffmpeg and a model download into the app.
 * The audio is sent to the provider and discarded; only the transcript is
 * logged, like any other desktop request.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit
const WHISPER_MODEL = "whisper-large-v3-turbo";
const TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

export const POST = withDesktopErrors(
  "transcribe",
  async (request: Request) => {
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
    const limit = await consumeNamedRateLimit(
      "desktopAssistant",
      device.userId,
    );
    if (!limit.allowed) {
      return desktopJson(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many requests just now. Please wait a moment.",
        },
        429,
        {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      );
    }

    const body = await readJsonObject(request, MAX_BODY_BYTES);
    const audio = typeof body?.audio === "string" ? body.audio : "";
    const mimeType = String(body?.mimeType ?? "audio/webm")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext = TYPES[mimeType];
    if (!audio || !/^[A-Za-z0-9+/=]+$/.test(audio) || !ext) {
      return desktopJson(
        {
          ok: false,
          code: "INVALID",
          message: "The recording could not be read. Please try again.",
        },
        422,
      );
    }
    const bytes = Buffer.from(audio, "base64");
    if (bytes.length < 200) {
      return desktopJson(
        { ok: false, code: "INVALID", message: "The recording was too short." },
        422,
      );
    }

    const meta = {
      userId: device.userId,
      tokenId: device.tokenId,
      hadImage: false,
      imageCount: 0,
      kind: "audio" as const,
      client: ctx.client,
      ipHash: ctx.ipHash,
    };
    const label = `[voice recording, ${Math.round(bytes.length / 1024)} KB ${mimeType}]`;

    // Whisper is served by Groq: use the operator's Groq link (or the site's
    // own key when it is a Groq key).
    const groq = (await resolveDesktopChain()).find((p) => p.id === "groq");
    if (!groq) {
      await logDesktopRequest({
        ...meta,
        provider: null,
        model: null,
        attempted: [],
        ttftMs: null,
        prompt: label,
        response: "",
        status: "error",
        error: "transcription: no Groq provider",
        promptTokens: null,
        completionTokens: null,
        latencyMs: Date.now() - started,
      });
      return desktopJson(
        {
          ok: false,
          code: "NOT_CONFIGURED",
          message: "Voice transcription is not available right now.",
        },
        503,
      );
    }

    const quota = await admitRequest(device.userId, new Date(), device.role);
    if (!quota.allowed) {
      return desktopJson(
        {
          ok: false,
          code: "QUOTA_EXCEEDED",
          message: "You have reached today's limit for the Bitecodes model.",
          resetsAt: quota.resetsAt.toISOString(),
        },
        429,
      );
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([bytes], { type: mimeType }),
      `recording.${ext}`,
    );
    form.append("model", WHISPER_MODEL);
    form.append("response_format", "json");
    const res = await fetch(
      `${(groq.baseUrl ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "")}/audio/transcriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${groq.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(90_000),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      text?: unknown;
      error?: { message?: unknown };
    };
    if (!res.ok || typeof data.text !== "string") {
      const reason = `groq ${res.status}: ${String(data.error?.message ?? "").slice(0, 200)}`;
      await logDesktopRequest({
        ...meta,
        provider: "groq",
        model: WHISPER_MODEL,
        attempted: [
          { provider: "groq", model: WHISPER_MODEL, outcome: reason },
        ],
        ttftMs: null,
        prompt: label,
        response: "",
        status: "error",
        error: reason,
        promptTokens: null,
        completionTokens: null,
        latencyMs: Date.now() - started,
      });
      return desktopJson(
        {
          ok: false,
          code: "UPSTREAM_ERROR",
          message: "Could not transcribe the recording. Please try again.",
        },
        502,
      );
    }

    const text = data.text.trim();
    await logDesktopRequest({
      ...meta,
      provider: "groq",
      model: WHISPER_MODEL,
      attempted: [{ provider: "groq", model: WHISPER_MODEL, outcome: "ok" }],
      ttftMs: null,
      prompt: label,
      response: text,
      status: "ok",
      error: null,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
    });
    // Roughly a token per 4 characters of transcript, plus a floor per request.
    await recordTokens(device.userId, 200 + Math.ceil(text.length / 4));
    return desktopJson({ ok: true, text });
  },
);
