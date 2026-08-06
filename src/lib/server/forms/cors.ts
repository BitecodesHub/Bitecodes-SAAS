import "server-only";

import { isOriginAllowed } from "@/lib/chatbot/domains";
import type { FormDoc } from "@/lib/server/db/types";

/**
 * CORS for the embedded form endpoints — the only cross-origin surface in the
 * app.
 *
 * The allowlist is the security boundary, so the echo is deliberately narrow:
 * the request `Origin` is reflected **only** when it matches the form's own
 * allowed domains. A wildcard `*` would let any site post to any form, and
 * `Access-Control-Allow-Origin` cannot take a list, so echoing a verified
 * origin is the only correct construction. `Vary: Origin` stops a CDN from
 * serving one customer's allow header to another's site.
 *
 * Note what CORS does and does not buy us: browsers refuse to *read* a
 * disallowed response, but a simple POST is still delivered. The submit route
 * therefore re-checks the origin server-side and refuses outright — CORS is the
 * courtesy, the server check is the enforcement.
 */

export function corsHeadersFor(
  origin: string | null | undefined,
  form: Pick<FormDoc, "allowedDomains">,
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && isOriginAllowed(origin, form.allowedDomains)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Preflight response. Cached briefly so a busy embed is not re-probed. */
export function preflightResponse(
  origin: string | null | undefined,
  form: Pick<FormDoc, "allowedDomains"> | null,
): Response {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    ...(form ? corsHeadersFor(origin, form) : { Vary: "Origin" }),
  };
  return new Response(null, { status: 204, headers });
}

/** JSON response carrying the form's CORS headers and no-store. */
export function corsJson(
  body: unknown,
  status: number,
  origin: string | null | undefined,
  form: Pick<FormDoc, "allowedDomains"> | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(form ? corsHeadersFor(origin, form) : { Vary: "Origin" }),
    },
  });
}
