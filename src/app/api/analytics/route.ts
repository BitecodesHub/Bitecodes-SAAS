import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSigningSecret, hasSigningSecret } from "@/lib/server/env";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import {
  ANALYTICS_MAX_BODY_BYTES,
  analyticsBatchSchema,
  analyticsVisitorHash,
  doNotTrackEnabled,
  isBotUserAgent,
  toAnalyticsEventRecords,
} from "@/lib/server/analytics/ingest";
import { insertAnalyticsEvents } from "@/lib/server/analytics/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First-party analytics collector.
 *
 * Accepts at most twenty events from the browser beacon and answers 204. There
 * is deliberately no CORS relaxation: only this origin's beacon calls it, and
 * a third-party page must not be able to write rows into the operator's data.
 *
 * Ignored traffic (a bot, Do Not Track, Global Privacy Control, or a missing
 * signing secret) receives the same 204 as accepted traffic. Telling a bot it
 * was detected only teaches it to change its user agent.
 */

function noContent(status = 204, headers?: HeadersInit): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** The rate-limit key never contains the address itself. */
function rateLimitKey(ip: string): string {
  return createHash("sha256").update(`analytics:${ip}`).digest("hex");
}

export async function POST(request: NextRequest): Promise<Response> {
  if (doNotTrackEnabled(request.headers)) {
    return noContent();
  }

  // Only this origin's beacon may write. Browsers send this header on
  // same-origin beacons and fetches; older clients that omit it still pass.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return noContent();
  }

  const userAgent = request.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) {
    return noContent();
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > ANALYTICS_MAX_BODY_BYTES
  ) {
    return noContent(413);
  }

  const ip = clientIp(request);
  const limit = await consumeNamedRateLimit("analytics", rateLimitKey(ip));
  if (!limit.allowed) {
    return noContent(429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  // `content-length` is only a hint: a chunked request can omit it, so the
  // decoded body is checked as well before it is parsed.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return noContent(400);
  }
  if (Buffer.byteLength(rawBody, "utf8") > ANALYTICS_MAX_BODY_BYTES) {
    return noContent(413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return noContent(400);
  }

  const parsed = analyticsBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return noContent(400);
  }

  // Without AUTH_SECRET there is no safe visitor identifier. Dropping the
  // batch is better than inventing a reversible or constant one.
  if (!hasSigningSecret()) {
    return noContent();
  }

  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10);
  const records = toAnalyticsEventRecords(parsed.data, {
    visitorHash: analyticsVisitorHash({
      ip,
      userAgent: userAgent ?? "",
      date,
      secret: getSigningSecret(),
    }),
    now,
    ownHost: request.nextUrl.hostname,
  });

  try {
    await insertAnalyticsEvents(records);
  } catch (error) {
    // Analytics must never break a page or leak identifiers into logs. A
    // database outage loses this batch; the visitor never sees an error.
    console.error(
      "[analytics] Could not store events:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  return noContent();
}
