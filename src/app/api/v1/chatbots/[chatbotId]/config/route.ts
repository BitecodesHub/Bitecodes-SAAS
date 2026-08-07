import type { NextRequest } from "next/server";
import { getChatbotForWidget } from "@/lib/server/chatbot/repository";
import { isOriginAllowed } from "@/lib/chatbot/domains";

/**
 * Public, read-only appearance config for the chat widget.
 *
 * This exists because the appearance editor was, until now, writing to a field
 * nothing read. `widget.js` is served as a static file shared by every customer,
 * so it cannot have one tenant's colours compiled into it — it has to ask. The
 * forms widget already worked this way (`/api/forms/[formId]/config`); the chat
 * widget simply never did, which meant twelve settings that saved successfully
 * and changed nothing a visitor saw.
 *
 * Deliberately narrow: appearance and the bot's display name, nothing else. Never
 * the owner id, the token hash, the system prompt, the allowlist, or the knowledge
 * base. The endpoint is reachable by any allowed site, so what it returns is what
 * a visitor's browser is allowed to know.
 *
 * Authorised exactly like the chat endpoint — id plus public token, then the
 * origin allowlist — so it cannot be used to confirm a bot exists or to read a
 * competitor's welcome message from an unlisted domain.
 */
export const dynamic = "force-dynamic";

/** Cached briefly at the edge: appearance changes rarely, visitors arrive often. */
const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

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

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
) {
  const { chatbotId } = await params;
  const origin = request.headers.get("origin");
  // The token arrives in the query string, because a preflight has no body. This
  // is the same contract the chat endpoint uses, and omitting it is what made
  // every embedded widget fail its preflight before.
  const token = new URL(request.url).searchParams.get("t");
  const bot = token ? await getChatbotForWidget(chatbotId, token) : null;

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      ...corsHeaders(origin, bot?.allowedDomains ?? null),
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
) {
  const { chatbotId } = await params;
  const origin = request.headers.get("origin");
  const token = new URL(request.url).searchParams.get("t") ?? "";

  const bot = await getChatbotForWidget(chatbotId, token);

  // One answer for a missing bot, a wrong token, and a paused bot — the same
  // rule the chat endpoint follows, so this cannot be used to enumerate bots.
  if (!bot || !isOriginAllowed(origin, bot.allowedDomains)) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: "NOT_AVAILABLE",
        message: "This assistant is not available.",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders(origin, bot?.allowedDomains ?? null),
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        chatbotId: bot.chatbotId,
        name: bot.name,
        appearance: bot.appearance,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL,
        ...corsHeaders(origin, bot.allowedDomains),
      },
    },
  );
}
