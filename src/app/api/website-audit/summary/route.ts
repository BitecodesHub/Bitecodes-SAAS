import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { auditSummaryInputSchema } from "@/lib/audit-summary";
import { generateAuditSummary } from "@/lib/server/audit-summary";
import { consumeRateLimit } from "@/lib/server/rate-limit";

/**
 * Turns a completed audit into a plain-language summary.
 *
 * Called by the results panel after the audit itself has rendered, so a slow or
 * unavailable model never delays the scores. The visitor already sees the
 * deterministic summary; this endpoint only replaces it with better wording
 * when a provider answers in time.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24_000;
const HOUR_MS = 60 * 60 * 1000;

function clientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`audit-summary:${candidate}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, code: "INVALID", message: "The audit result is too large." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  // A separate bucket from the audit itself. Sharing the audit's three-per-hour
  // cap would mean every audit spent two of its three requests (one to run,
  // one to summarise), so a visitor would be refused a second audit after a
  // single attempt. The summary still has a hard ceiling because it is the
  // only call here that can spend money at a provider.
  const rateLimit = await consumeRateLimit({
    bucket: "audit-summary",
    key: clientKey(request),
    max: 6,
    windowMs: HOUR_MS,
  });
  if (!rateLimit.allowed) {
    return Response.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, code: "INVALID", message: "Send a valid audit result." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = auditSummaryInputSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, code: "INVALID", message: "Send a valid audit result." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // `generateAuditSummary` never throws for an AI failure; it returns the
  // deterministic summary instead.
  const result = await generateAuditSummary(parsed.data);

  return Response.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
