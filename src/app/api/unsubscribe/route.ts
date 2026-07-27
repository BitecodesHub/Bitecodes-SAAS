import type { NextRequest } from "next/server";
import { applyUnsubscribe } from "@/lib/server/email/unsubscribe";

/**
 * The URI advertised in `List-Unsubscribe`.
 *
 * It must accept **POST**, because outreach mail also carries
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Under RFC 8058 that tells
 * Gmail, Yahoo, and Outlook they may unsubscribe on the recipient's behalf by
 * POSTing to this exact URI — no page load, no click. Advertising the header and
 * then answering 405 is worse than not advertising it at all: the mailbox
 * provider records a failed unsubscribe, and for bulk senders those providers now
 * treat a working one-click opt-out as a delivery requirement.
 *
 * GET redirects to the human-facing page, so the same link works whether it is
 * followed by a person or by a mail client.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readToken(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get("t");
}

export async function POST(request: NextRequest) {
  const outcome = await applyUnsubscribe(readToken(request));

  // Mailbox providers do not show a body; the status code is the whole answer.
  // 200 on success, and a plain 400 for a forged token rather than an error page.
  return new Response(outcome.ok ? "Unsubscribed" : "Invalid request", {
    status: outcome.ok ? 200 : 400,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * A person following the link. Redirect to the page that explains what happened,
 * preserving the token so the page performs and reports the same action.
 */
export function GET(request: NextRequest) {
  const token = readToken(request);
  const destination = new URL("/unsubscribe", request.nextUrl.origin);
  if (token) destination.searchParams.set("t", token);

  return Response.redirect(destination, 302);
}

/** Advertised so a probing client learns what is allowed. */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET, POST, OPTIONS", "Cache-Control": "no-store" },
  });
}
