import "server-only";

import { isOriginAllowed } from "@/lib/chatbot/domains";
import type { BookingConfigDoc } from "@/lib/server/db/types";

/**
 * CORS for the public booking endpoints.
 *
 * Same construction as the forms equivalent, and for the same reasons: the
 * request `Origin` is echoed **only** when it matches this config's own
 * allowlist, never a wildcard, because `Access-Control-Allow-Origin` cannot
 * carry a list and a `*` would let any site book against any calendar.
 * `Vary: Origin` stops a CDN from handing one customer's allow header to
 * another customer's site.
 *
 * CORS is the courtesy, not the enforcement. A browser refuses to *read* a
 * disallowed response, but a simple POST is still delivered, so the booking
 * pipeline re-checks the origin server-side and refuses outright.
 *
 * Every response carries these headers — including refusals. A 403 or a 404
 * without them arrives at the widget as an opaque network error, and the embed
 * ends up saying "unreachable" when the server in fact answered with the exact
 * reason.
 */

type CorsConfig = Pick<BookingConfigDoc, "allowedDomains">;

export function corsHeadersFor(
  origin: string | null | undefined,
  config: CorsConfig,
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && isOriginAllowed(origin, config.allowedDomains)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Preflight response.
 *
 * `config` is null when the preflight could not resolve one — a preflight
 * carries no body, so the caller has to read the token off the query string.
 * See the note in the route handlers: widgets MUST put `?t=` on the URL, and
 * omitting it has broken every embed once already.
 */
export function preflightResponse(
  origin: string | null | undefined,
  config: CorsConfig | null,
  methods: string,
): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      ...(config ? corsHeadersFor(origin, config) : { Vary: "Origin" }),
    },
  });
}

/** JSON response carrying this config's CORS headers, and never cached. */
export function corsJson(
  body: unknown,
  status: number,
  origin: string | null | undefined,
  config: CorsConfig | null,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(config ? corsHeadersFor(origin, config) : { Vary: "Origin" }),
      ...extraHeaders,
    },
  });
}
