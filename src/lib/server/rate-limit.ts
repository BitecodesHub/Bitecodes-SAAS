import "server-only";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

type RateLimitEntry = { count: number; resetAt: number };

declare global {
  var __bitecodesRateLimits: Map<string, RateLimitEntry> | undefined;
  var __bitecodesAuditRateLimits: Map<string, RateLimitEntry> | undefined;
  var __bitecodesAiRateLimits: Map<string, RateLimitEntry> | undefined;
}

const limits = (global.__bitecodesRateLimits ??= new Map());
const auditLimits = (global.__bitecodesAuditRateLimits ??= new Map());
const aiLimits = (global.__bitecodesAiRateLimits ??= new Map());

function consumeRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  maximum: number,
  windowMs: number,
  now: number,
) {
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maximum) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function consumeContactRateLimit(key: string, now = Date.now()) {
  return consumeRateLimit(limits, key, MAX_REQUESTS, WINDOW_MS, now);
}

export function consumeAuditRateLimit(key: string, now = Date.now()) {
  return consumeRateLimit(auditLimits, key, 3, WINDOW_MS, now);
}

export function consumeAiRateLimit(key: string, now = Date.now()) {
  return consumeRateLimit(aiLimits, key, 5, 24 * WINDOW_MS, now);
}
