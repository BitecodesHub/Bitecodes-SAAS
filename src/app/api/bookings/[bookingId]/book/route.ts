import type { NextRequest } from "next/server";
import { getBookingConfigForPublic } from "@/lib/server/bookings/repository";
import { handleBooking } from "@/lib/server/bookings/book";
import { corsJson, preflightResponse } from "@/lib/server/bookings/cors";

/**
 * The public endpoint an embedded booking widget posts to.
 *
 * Transport only. Every decision — origin, rate limit, validation, whether the
 * requested time is genuinely bookable, credits, and the refund when the race
 * for a slot is lost — lives in `@/lib/server/bookings/book`, which is where it
 * can be tested without a server.
 *
 * Every response carries this config's CORS headers, refusals included. A 403
 * without them reaches the widget as an unexplained network error, which is how
 * an embed ends up reporting "unreachable" about a server that answered.
 */
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = "POST, OPTIONS";

/** A booking is a handful of short fields; anything larger is a probe. */
const MAX_BODY_BYTES = 16 * 1024;

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  // No body on a preflight, so the token comes off the query string. Widgets
  // MUST put `?t=` on the URL — omitting it has broken every embed once
  // already; see the note in src/app/widget.js/route.ts.
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const origin = request.headers.get("origin");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return corsJson(
      { ok: false, code: "TOO_LARGE", message: "That request is too large." },
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
    return corsJson(
      { ok: false, code: "INVALID", message: "Body must be a JSON object." },
      400,
      origin,
      null,
    );
  }

  // The token may travel in the body or on the URL; the widget sends both so
  // the preflight and the request resolve the same config.
  const token =
    (typeof body._token === "string" ? body._token : "") ||
    (new URL(request.url).searchParams.get("t") ?? "");

  const config = await getBookingConfigForPublic(bookingId, token);
  if (!config) {
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

  const outcome = await handleBooking({
    config,
    startIso: body.startIso,
    customer: {
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
    },
    origin,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
    visitorTimezone: typeof body.timezone === "string" ? body.timezone : null,
  });

  switch (outcome.kind) {
    case "ok":
      return corsJson(
        {
          ok: true,
          message: outcome.message,
          data: {
            bookingId: outcome.bookingId,
            startIso: outcome.startIso,
            endIso: outcome.endIso,
            timezone: config.timezone,
          },
        },
        201,
        origin,
        config,
      );

    case "origin-denied":
      return corsJson(
        {
          ok: false,
          code: "ORIGIN_NOT_ALLOWED",
          message:
            "Bookings are not enabled for this website. Add the domain in your Bitecodes dashboard.",
        },
        403,
        origin,
        config,
      );

    case "rate-limited":
      return corsJson(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many attempts. Please try again shortly.",
        },
        429,
        origin,
        config,
        { "Retry-After": String(outcome.retryAfterSeconds) },
      );

    case "invalid":
      return corsJson(
        {
          ok: false,
          code: "INVALID",
          message: "Please check the highlighted fields.",
          fieldErrors: outcome.fieldErrors,
        },
        422,
        origin,
        config,
      );

    case "slot-unavailable":
      return corsJson(
        {
          ok: false,
          code: "SLOT_UNAVAILABLE",
          message: "That time is not available. Please choose another slot.",
        },
        409,
        origin,
        config,
      );

    case "slot-taken":
      return corsJson(
        {
          ok: false,
          code: "SLOT_TAKEN",
          message: "Sorry, that time was just booked. Please choose another.",
        },
        409,
        origin,
        config,
      );

    case "out-of-credits":
      return corsJson(
        {
          ok: false,
          code: "OWNER_OUT_OF_CREDITS",
          message:
            "Booking is temporarily unavailable. The site owner has been notified.",
        },
        402,
        origin,
        config,
      );
  }
}
