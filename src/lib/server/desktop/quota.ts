import "server-only";

import {
  desktopProviders,
  desktopUsageDaily,
} from "@/lib/server/db/collections";
import type { DesktopLimitsDoc } from "@/lib/server/db/types";

/**
 * Cost and abuse controls for the desktop app's Bitecodes model.
 *
 * Three operator-set daily caps (UTC days; 0 = unlimited):
 *   - requests per user, enforced atomically (the counter is incremented and
 *     checked in one update, so parallel requests cannot all slip through);
 *   - tokens per user and tokens across all users, checked before each request
 *     against tokens already used (soft: one in-flight request can overshoot).
 *
 * Counters live in their own collection keyed by day, expire after ~40 days,
 * and never touch the prompt log, so checks stay O(1) however big the log is.
 */

export const LIMITS_ID = "__limits__" as const;
const COUNTER_TTL_MS = 40 * 24 * 60 * 60 * 1000;
const ALL = "*";

export interface DesktopLimits {
  userDailyRequests: number;
  userDailyTokens: number;
  globalDailyTokens: number;
  /** "staff" = only non-customer accounts may use the Bitecodes model. */
  access: "everyone" | "staff";
}

/** Generous for real use, tight enough that one abusive account cannot run up a bill. */
export const DEFAULT_LIMITS: DesktopLimits = {
  userDailyRequests: 300,
  userDailyTokens: 400_000,
  globalDailyTokens: 5_000_000,
  access: "everyone",
};

const MAX_LIMIT = 1_000_000_000;

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Next UTC midnight: when every daily cap resets. */
export function resetsAt(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

function clampLimit(v: unknown, fallback: number): number {
  const n =
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(Math.max(n, 0), MAX_LIMIT);
}

export async function getLimits(): Promise<DesktopLimits> {
  const doc = await (await desktopProviders()).findOne({ _id: LIMITS_ID });
  if (doc && doc.kind === "limits") {
    const l = doc as DesktopLimitsDoc;
    return {
      userDailyRequests: clampLimit(
        l.userDailyRequests,
        DEFAULT_LIMITS.userDailyRequests,
      ),
      userDailyTokens: clampLimit(
        l.userDailyTokens,
        DEFAULT_LIMITS.userDailyTokens,
      ),
      globalDailyTokens: clampLimit(
        l.globalDailyTokens,
        DEFAULT_LIMITS.globalDailyTokens,
      ),
      access: l.access === "staff" ? "staff" : "everyone",
    };
  }
  return { ...DEFAULT_LIMITS };
}

export async function setLimits(limits: DesktopLimits): Promise<DesktopLimits> {
  const clean: DesktopLimits = {
    userDailyRequests: clampLimit(
      limits.userDailyRequests,
      DEFAULT_LIMITS.userDailyRequests,
    ),
    userDailyTokens: clampLimit(
      limits.userDailyTokens,
      DEFAULT_LIMITS.userDailyTokens,
    ),
    globalDailyTokens: clampLimit(
      limits.globalDailyTokens,
      DEFAULT_LIMITS.globalDailyTokens,
    ),
    access: limits.access === "staff" ? "staff" : "everyone",
  };
  const now = new Date();
  await (
    await desktopProviders()
  ).updateOne(
    { _id: LIMITS_ID },
    {
      $set: { kind: "limits", ...clean, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return clean;
}

export type QuotaDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "no_access" | "user_requests" | "user_tokens" | "global_tokens";
      resetsAt: Date;
    };

async function counter(day: string, scope: string) {
  return (await desktopUsageDaily()).findOne({ _id: `${day}|${scope}` });
}

/**
 * Admits one request for `userId`, or says which cap it hit. On admission the
 * user's and the global request counters have been incremented.
 */
export async function admitRequest(
  userId: string,
  now = new Date(),
  role?: string,
): Promise<QuotaDecision> {
  const limits = await getLimits();
  const day = utcDay(now);
  const reset = resetsAt(now);
  if (limits.access === "staff" && role === "customer") {
    return { allowed: false, reason: "no_access", resetsAt: reset };
  }
  const [userUsage, allUsage] = await Promise.all([
    counter(day, userId),
    counter(day, ALL),
  ]);
  if (
    limits.globalDailyTokens &&
    (allUsage?.tokens ?? 0) >= limits.globalDailyTokens
  ) {
    return { allowed: false, reason: "global_tokens", resetsAt: reset };
  }
  if (
    limits.userDailyTokens &&
    (userUsage?.tokens ?? 0) >= limits.userDailyTokens
  ) {
    return { allowed: false, reason: "user_tokens", resetsAt: reset };
  }

  const col = await desktopUsageDaily();
  const expiresAt = new Date(now.getTime() + COUNTER_TTL_MS);
  const after = await col.findOneAndUpdate(
    { _id: `${day}|${userId}` },
    {
      $inc: { requests: 1 },
      $setOnInsert: { day, scope: userId, tokens: 0, expiresAt },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (
    limits.userDailyRequests &&
    (after?.requests ?? 0) > limits.userDailyRequests
  ) {
    // Over the cap: undo, so refused attempts do not count as usage.
    await col.updateOne(
      { _id: `${day}|${userId}` },
      { $inc: { requests: -1 } },
    );
    return { allowed: false, reason: "user_requests", resetsAt: reset };
  }
  await col.updateOne(
    { _id: `${day}|${ALL}` },
    {
      $inc: { requests: 1 },
      $setOnInsert: { day, scope: ALL, tokens: 0, expiresAt },
    },
    { upsert: true },
  );
  return { allowed: true };
}

/** Adds a finished request's tokens to the user's and the global counters. Best effort. */
export async function recordTokens(
  userId: string,
  tokens: number,
  now = new Date(),
): Promise<void> {
  const n = Math.max(0, Math.round(tokens || 0));
  if (!n) return;
  try {
    const col = await desktopUsageDaily();
    const day = utcDay(now);
    const expiresAt = new Date(now.getTime() + COUNTER_TTL_MS);
    await Promise.all(
      [userId, ALL].map((scope) =>
        col.updateOne(
          { _id: `${day}|${scope}` },
          {
            $inc: { tokens: n },
            $setOnInsert: { day, scope, requests: 0, expiresAt },
          },
          { upsert: true },
        ),
      ),
    );
  } catch (error) {
    console.error(
      "[desktop] usage counter write failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export interface TodayUsage {
  day: string;
  requests: number;
  tokens: number;
  resetsAt: Date;
}

export async function usageToday(now = new Date()): Promise<TodayUsage> {
  const day = utcDay(now);
  const all = await counter(day, ALL);
  return {
    day,
    requests: all?.requests ?? 0,
    tokens: all?.tokens ?? 0,
    resetsAt: resetsAt(now),
  };
}

/** Rough token estimate when a provider does not report usage (≈4 chars/token). */
export function estimateTokens(
  prompt: string,
  answer: string,
  images: number,
): number {
  return Math.ceil((prompt.length + answer.length) / 4) + images * 1000;
}
