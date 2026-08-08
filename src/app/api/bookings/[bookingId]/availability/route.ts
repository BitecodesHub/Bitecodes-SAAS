import type { NextRequest } from "next/server";
import { getBookingConfigForPublic } from "@/lib/server/bookings/repository";
import { loadAvailability } from "@/lib/server/bookings/book";
import { corsJson, preflightResponse } from "@/lib/server/bookings/cors";

/**
 * Public, read-only availability for an embedded booking widget.
 *
 * Anonymous and cross-origin, so it sits here rather than under `/api/v1`,
 * which is the Bearer-key surface. The credential is the config's public token
 * plus its domain allowlist, exactly as for forms.
 *
 * Everything a picker needs comes back in this one response — timezone, slot
 * length and appearance alongside the free slots — so the widget renders after
 * a single round trip. Nothing about the account comes back with it: no owner
 * id, no notify list, no token hash, and no bookings.
 */
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = "GET, OPTIONS";

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  // A preflight carries no body, so the token has to come off the query string.
  // Widgets MUST put `?t=` on the URL: without it there is nothing to resolve
  // the config by, the origin cannot be echoed, and every embed breaks with an
  // opaque CORS failure. See the note in src/app/widget.js/route.ts.
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const config = token
    ? await getBookingConfigForPublic(bookingId, token)
    : null;
  return preflightResponse(
    request.headers.get("origin"),
    config,
    ALLOWED_METHODS,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";

  const config = await getBookingConfigForPublic(bookingId, token);
  if (!config) {
    // One answer for "no such config", "wrong token" and "paused", so the
    // endpoint cannot be used to enumerate calendars or probe their state.
    return corsJson(
      {
        ok: false,
        code: "NOT_AVAILABLE",
        message: "This booking page is not available.",
      },
      404,
      origin,
      null,
    );
  }

  const view = await loadAvailability(config, {
    days: url.searchParams.get("days"),
  });

  return corsJson({ ok: true, data: view }, 200, origin, config);
}
