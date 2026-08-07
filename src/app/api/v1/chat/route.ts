import type { NextRequest } from "next/server";
import { handleChat, type ChatDenial } from "@/lib/server/chat/gateway";
import { getChatbotForWidget } from "@/lib/server/chatbot/repository";
import { isOriginAllowed } from "@/lib/chatbot/domains";

/**
 * The public chat endpoint the embedded widget talks to.
 *
 * Streams Server-Sent Events rather than returning one JSON blob: a grounded
 * answer takes a second or two to generate, and a visitor watching words appear
 * is a fundamentally different experience from one watching a spinner. SSE is
 * also plain HTTP, so it needs no WebSocket upgrade and survives CDNs.
 *
 * Cross-origin by nature, so every response carries the bot's own CORS headers —
 * echoing the request Origin only when it matches that bot's allowlist, never a
 * wildcard.
 */
export const dynamic = "force-dynamic";
/** Model latency plus streaming; well inside the platform ceiling. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 16 * 1024;

function corsHeaders(
  origin: string | null,
  allowedDomains: readonly string[] | null,
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && allowedDomains && isOriginAllowed(origin, allowedDomains)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  allowedDomains: readonly string[] | null,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(origin, allowedDomains),
      ...extra,
    },
  });
}

/** Maps a refusal to a visitor-appropriate status and message. */
function denialResponse(
  denial: ChatDenial,
  origin: string | null,
  allowedDomains: readonly string[] | null,
): Response {
  switch (denial.kind) {
    case "not-available":
      return jsonResponse(
        {
          ok: false,
          code: "NOT_AVAILABLE",
          message: "This assistant is not available.",
        },
        404,
        origin,
        allowedDomains,
      );
    case "origin-denied":
      return jsonResponse(
        {
          ok: false,
          code: "ORIGIN_NOT_ALLOWED",
          message:
            "This assistant is not enabled for this website. Add the domain in your Bitecodes dashboard.",
        },
        403,
        origin,
        allowedDomains,
      );
    case "invalid":
      return jsonResponse(
        { ok: false, code: "INVALID", message: denial.message },
        422,
        origin,
        allowedDomains,
      );
    case "rate-limited":
      return jsonResponse(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many messages just now. Please try again shortly.",
        },
        429,
        origin,
        allowedDomains,
        { "Retry-After": String(denial.retryAfterSeconds) },
      );
    case "out-of-tokens":
      return jsonResponse(
        {
          ok: false,
          code: "OWNER_OUT_OF_TOKENS",
          message:
            "This assistant is temporarily unavailable. The site owner has been notified.",
        },
        402,
        origin,
        allowedDomains,
      );
    case "not-configured":
      return jsonResponse(
        {
          ok: false,
          code: "NOT_CONFIGURED",
          message: "This assistant is not fully set up yet.",
        },
        503,
        origin,
        allowedDomains,
      );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Preflight carries no body, so the token is unavailable. `?t=` lets the
  // widget request an accurate preflight; without it we reply permissively on
  // method/headers but grant no origin, which is the safe default.
  const token = new URL(request.url).searchParams.get("t");
  const chatbotId = new URL(request.url).searchParams.get("id");
  const bot =
    token && chatbotId ? await getChatbotForWidget(chatbotId, token) : null;

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      ...corsHeaders(origin, bot?.allowedDomains ?? null),
    },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse(
      { ok: false, code: "TOO_LARGE", message: "That message is too long." },
      413,
      origin,
      null,
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { ok: false, code: "INVALID", message: "Body must be a JSON object." },
      400,
      origin,
      null,
    );
  }

  const chatbotId = typeof body.chatbotId === "string" ? body.chatbotId : "";
  const publicToken =
    typeof body.publicToken === "string" ? body.publicToken : "";
  const message = typeof body.message === "string" ? body.message : "";
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : null;
  const history = Array.isArray(body.history)
    ? (body.history as unknown[])
        .filter(
          (turn): turn is { role: "user" | "assistant"; content: string } =>
            typeof turn === "object" &&
            turn !== null &&
            (("role" in turn && (turn as { role: unknown }).role === "user") ||
              (turn as { role: unknown }).role === "assistant") &&
            typeof (turn as { content: unknown }).content === "string",
        )
        .slice(-6)
    : [];

  // Resolved once here so a refusal can still carry correct CORS headers.
  const bot = await getChatbotForWidget(chatbotId, publicToken);
  const allowedDomains = bot?.allowedDomains ?? null;

  let outcome;
  try {
    outcome = await handleChat({
      chatbotId,
      publicToken,
      message,
      conversationId,
      origin,
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null,
      history,
      // Already fetched above for the CORS headers; reuse it rather than
      // paying for the same query twice on every message.
      resolvedBot: bot,
    });
  } catch (error) {
    console.error(
      "[chat] gateway failed:",
      error instanceof Error ? error.message : error,
    );
    return jsonResponse(
      {
        ok: false,
        code: "UPSTREAM_ERROR",
        message: "The assistant could not answer just now. Please try again.",
      },
      502,
      origin,
      allowedDomains,
    );
  }

  if (outcome.kind !== "ok") {
    return denialResponse(outcome, origin, allowedDomains);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        for await (const delta of outcome.stream) {
          send("token", { delta });
        }
        const usage = await outcome.settle();
        send("done", {
          sources: outcome.sources,
          grounded: outcome.grounded,
          usage,
        });
      } catch (error) {
        console.error(
          "[chat] stream failed:",
          error instanceof Error ? error.message : error,
        );
        // Still settle, so a partial answer that consumed tokens is billed.
        await outcome.settle().catch(() => undefined);
        send("error", {
          message: "The answer was cut short. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Conversation-Id": outcome.conversationId,
      ...corsHeaders(origin, allowedDomains),
    },
  });
}
