import "server-only";

import { rateLimits } from "@/lib/server/db/collections";

/**
 * Shared, fixed-window rate limiting backed by MongoDB.
 *
 * The previous implementation used an in-process `Map`, which means on any
 * multi-instance or serverless deployment each instance kept its own counter —
 * so an "5 requests per hour" cap was really "5 per hour per instance" and the
 * OpenRouter spend cap was not actually enforced. Counters now live in the
 * database, keyed by window start so two concurrent requests can never
 * disagree about when the window ends.
 *
 * If the database is unreachable the limiter degrades to a per-instance
 * in-memory counter rather than allowing unlimited requests.
 */

const HOUR_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Requests remaining in the current window. */
  remaining: number;
}

export interface RateLimitOptions {
  /** Namespace, so two features never share a counter. */
  bucket: string;
  /** Caller-supplied identity — always a hash, never a raw IP or email. */
  key: string;
  max: number;
  windowMs: number;
  now?: number;
}

declare global {
  var __bitecodesFallbackRateLimits:
    | Map<string, { count: number; resetAt: number }>
    | undefined;
}

const fallbackStore = (global.__bitecodesFallbackRateLimits ??= new Map());

/**
 * Resolves which fixed window a timestamp belongs to.
 *
 * Window start is part of the document id, so `resetAt` is a pure function of
 * the id. That is what makes the counter safe under concurrency: two racing
 * upserts address the same document and therefore cannot disagree about when
 * the window ends. Exported for direct testing — this arithmetic is where an
 * off-by-one would silently double or halve every limit.
 */
export function resolveWindow(
  bucket: string,
  key: string,
  windowMs: number,
  now: number,
) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return {
    id: `${bucket}:${key}:${windowStart}`,
    windowStart,
    resetAtMs: windowStart + windowMs,
  };
}

/**
 * Turns a consumed count into a verdict. `count` is the value *after* this
 * request was counted, so the first request arrives here as 1.
 */
export function decideRateLimit(
  count: number,
  max: number,
  resetAtMs: number,
  now: number,
): RateLimitResult {
  if (count > max) {
    return {
      allowed: false,
      // Always at least one second: a zero would tell a client to retry
      // immediately, producing a hot loop against a closed window.
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, max - count),
  };
}

/**
 * In-memory fallback, used only when the database call fails. Also prunes
 * expired entries so a long-lived process cannot grow unbounded.
 */
export function consumeFallbackRateLimit(
  id: string,
  max: number,
  resetAtMs: number,
  now: number,
): RateLimitResult {
  if (fallbackStore.size > 10_000) {
    for (const [key, entry] of fallbackStore) {
      if (entry.resetAt <= now) fallbackStore.delete(key);
    }
  }

  const current = fallbackStore.get(id);
  const count = !current || current.resetAt <= now ? 1 : current.count + 1;
  fallbackStore.set(id, { count, resetAt: resetAtMs });

  return decideRateLimit(count, max, resetAtMs, now);
}

export async function consumeRateLimit({
  bucket,
  key,
  max,
  windowMs,
  now = Date.now(),
}: RateLimitOptions): Promise<RateLimitResult> {
  const { id, resetAtMs } = resolveWindow(bucket, key, windowMs, now);

  try {
    const collection = await rateLimits();
    const updated = await collection.findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          resetAt: new Date(resetAtMs),
          // Kept slightly beyond the window so the TTL monitor never deletes
          // a counter that is still authoritative.
          expiresAt: new Date(resetAtMs + 60_000),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    return decideRateLimit(updated?.count ?? 1, max, resetAtMs, now);
  } catch {
    return consumeFallbackRateLimit(id, max, resetAtMs, now);
  }
}

// ---------------------------------------------------------------------------
// Named limits
// ---------------------------------------------------------------------------
// Each feature gets its own bucket and its own budget. Grouped here so the
// whole abuse surface of the app is visible in one place.

export const RATE_LIMITS = {
  contact: { max: 5, windowMs: HOUR_MS },
  audit: { max: 3, windowMs: HOUR_MS },
  ai: { max: 5, windowMs: 24 * HOUR_MS },
  /** Conversational, so a higher ceiling — but still a hard daily cap. */
  chat: { max: 40, windowMs: HOUR_MS },
  chatDaily: { max: 150, windowMs: 24 * HOUR_MS },
  /** Brute-force guard, on top of the per-account lockout. */
  adminLogin: { max: 10, windowMs: HOUR_MS },
  passwordReset: { max: 5, windowMs: HOUR_MS },
  /** Magic links are credentials; requesting them is capped like resets. */
  loginLink: { max: 5, windowMs: HOUR_MS },
  /** Embedded form submissions, per form + visitor IP. */
  formSubmit: { max: 20, windowMs: HOUR_MS },
  /** Whole-form ceiling, so one popular embed cannot drain a credit pack. */
  formSubmitPerForm: { max: 500, windowMs: HOUR_MS },
  /**
   * One "out of credits" warning per form per day. A form that is turning away
   * submissions must not spam the very inbox it is meant to fill.
   */
  formCreditsWarning: { max: 1, windowMs: 24 * HOUR_MS },
  portalLogin: { max: 8, windowMs: HOUR_MS },
  /**
   * Self-serve sign-ups, per IP. Low, because each one sends an email to an
   * address the sender chose — an uncapped form is a way to have our domain
   * deliver unwanted mail to strangers, which costs us our sending reputation
   * rather than costing the abuser anything.
   */
  signup: { max: 5, windowMs: HOUR_MS },
  /** Re-sending a verification link, capped per address as well as per IP. */
  verifyResend: { max: 4, windowMs: HOUR_MS },
  newsletter: { max: 5, windowMs: HOUR_MS },
  /** Password attempts for the gated Notes installer download, per IP. */
  notesDownload: { max: 10, windowMs: HOUR_MS },
  unsubscribe: { max: 30, windowMs: HOUR_MS },
  analytics: { max: 200, windowMs: HOUR_MS },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Consumes one unit from a named limit. */
export function consumeNamedRateLimit(
  name: RateLimitName,
  key: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  const { max, windowMs } = RATE_LIMITS[name];
  return consumeRateLimit({ bucket: name, key, max, windowMs, now });
}

export function consumeContactRateLimit(key: string, now = Date.now()) {
  return consumeNamedRateLimit("contact", key, now);
}

export function consumeAuditRateLimit(key: string, now = Date.now()) {
  return consumeNamedRateLimit("audit", key, now);
}

export function consumeAiRateLimit(key: string, now = Date.now()) {
  return consumeNamedRateLimit("ai", key, now);
}
