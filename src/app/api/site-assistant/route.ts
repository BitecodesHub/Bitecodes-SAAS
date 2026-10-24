import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { resolveAutomationChain } from "@/lib/server/desktop/providers";
import { runTextChain } from "@/lib/server/desktop/gateway";
import {
  ASSISTANT_MAX_PROMPT_CHARS,
  ASSISTANT_SYSTEM_PROMPT,
  hasUnsupportedPrice,
  parseAssistantHistory,
  SAFE_PRICING_ANSWER,
  sanitizeAnswer,
} from "@/lib/assistant/grounding";

/**
 * The site-wide assistant.
 *
 * Public by definition, so it is deliberately narrow: short questions, short
 * answers, a strict per-IP budget, and a system prompt built from the same
 * service/pricing/FAQ data the pages render. That grounding matters in both
 * directions — it keeps the model from inventing a price, and it means the
 * assistant can be useful with no per-customer setup.
 *
 * When no provider is configured the endpoint answers 503 rather than
 * pretending to think; the UI falls back to the contact and booking paths.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12_000;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`assistant:${candidate}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "Please keep the question short." }, 413);
  }

  const limit = await consumeNamedRateLimit(
    "siteAssistant",
    clientKey(request),
  );
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        message:
          "You have reached this hour's question limit. A person can pick it up from here.",
        fallback: true,
      },
      429,
    );
  }

  let payload: unknown;
  try {
    const body = await request.text();
    // A chunked request may omit content-length, so the ceiling is enforced on
    // the body itself as well.
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return json(
        { ok: false, message: "Please keep the question short." },
        413,
      );
    }
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, message: "Send a question." }, 400);
  }

  const prompt =
    payload && typeof payload === "object"
      ? (payload as { prompt?: unknown }).prompt
      : undefined;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return json({ ok: false, message: "Send a question." }, 400);
  }
  if (prompt.length > ASSISTANT_MAX_PROMPT_CHARS) {
    return json(
      {
        ok: false,
        message: `Please keep the question under ${ASSISTANT_MAX_PROMPT_CHARS} characters.`,
      },
      400,
    );
  }

  const history = parseAssistantHistory(
    (payload as { history?: unknown }).history,
  );

  const chain = await resolveAutomationChain();
  if (chain.length === 0) {
    return json(
      {
        ok: false,
        message: "The assistant is offline right now.",
        fallback: true,
      },
      503,
    );
  }

  try {
    // A queued free-tier provider can sit silent for half a minute. One
    // bounded retry recovers those transient stalls without making the visitor
    // wait for a second full first-token deadline.
    const ask = () =>
      runTextChain(chain, {
        system: ASSISTANT_SYSTEM_PROMPT,
        history,
        prompt: prompt.trim(),
        // The visible answer is capped at 90 words; the extra headroom is for
        // providers that spend tokens reasoning before they answer.
        maxTokens: 400,
        temperature: 0.15,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
      });

    let result: Awaited<ReturnType<typeof ask>>;
    try {
      result = await ask();
    } catch (firstError) {
      if (request.signal.aborted) throw firstError;
      console.warn("[site-assistant] retrying after a provider stall");
      result = await ask();
    }

    const answer = sanitizeAnswer(result.text);
    if (!answer) {
      return json(
        {
          ok: false,
          message: "That one did not come through. Ask again.",
          fallback: true,
        },
        502,
      );
    }

    if (hasUnsupportedPrice(answer)) {
      console.warn(
        "[site-assistant] blocked an answer containing an unpublished price",
      );
      return json({ ok: true, text: SAFE_PRICING_ANSWER }, 200);
    }

    return json({ ok: true, text: answer }, 200);
  } catch (error) {
    console.error(
      "[site-assistant] provider failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return json(
      {
        ok: false,
        message: "The assistant could not answer right now.",
        fallback: true,
      },
      502,
    );
  }
}
