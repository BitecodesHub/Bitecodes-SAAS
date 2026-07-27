import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import {
  RATE_LIMITS,
  consumeAiRateLimit,
  consumeAuditRateLimit,
  consumeContactRateLimit,
  consumeFallbackRateLimit,
  consumeNamedRateLimit,
  consumeRateLimit,
  decideRateLimit,
  resolveWindow,
} from "@/lib/server/rate-limit";

const HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure window arithmetic — runs everywhere, no database needed. This is where
// an off-by-one would silently double or halve every limit in the app.
// ---------------------------------------------------------------------------

describe("resolveWindow", () => {
  it("floors the timestamp to the window boundary", () => {
    expect(resolveWindow("b", "k", 1000, 0).windowStart).toBe(0);
    expect(resolveWindow("b", "k", 1000, 999).windowStart).toBe(0);
    expect(resolveWindow("b", "k", 1000, 1000).windowStart).toBe(1000);
    expect(resolveWindow("b", "k", 1000, 1999).windowStart).toBe(1000);
  });

  it("derives resetAt from the window, not from the request time", () => {
    // Two requests in the same window must agree on the reset time — this is
    // what makes concurrent upserts safe.
    const early = resolveWindow("b", "k", HOUR_MS, HOUR_MS * 5 + 1);
    const late = resolveWindow("b", "k", HOUR_MS, HOUR_MS * 6 - 1);
    expect(early.resetAtMs).toBe(late.resetAtMs);
    expect(early.resetAtMs).toBe(HOUR_MS * 6);
  });

  it("gives the same id for the same window and different ids across windows", () => {
    const first = resolveWindow("bucket", "key", HOUR_MS, HOUR_MS * 2 + 5);
    const same = resolveWindow("bucket", "key", HOUR_MS, HOUR_MS * 2 + 500);
    const next = resolveWindow("bucket", "key", HOUR_MS, HOUR_MS * 3);
    expect(first.id).toBe(same.id);
    expect(first.id).not.toBe(next.id);
  });

  it("namespaces by bucket and key so features never share a counter", () => {
    const now = HOUR_MS;
    expect(resolveWindow("a", "k", HOUR_MS, now).id).not.toBe(
      resolveWindow("b", "k", HOUR_MS, now).id,
    );
    expect(resolveWindow("a", "k1", HOUR_MS, now).id).not.toBe(
      resolveWindow("a", "k2", HOUR_MS, now).id,
    );
  });
});

describe("decideRateLimit", () => {
  it("allows up to and including the maximum", () => {
    const resetAt = 10_000;
    expect(decideRateLimit(1, 3, resetAt, 0)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 2,
    });
    expect(decideRateLimit(3, 3, resetAt, 0)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 0,
    });
  });

  it("blocks past the maximum and reports the wait", () => {
    expect(decideRateLimit(4, 3, 60_000, 0)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
      remaining: 0,
    });
  });

  it("never returns a zero retry-after, which would cause a hot retry loop", () => {
    // Window has already closed by the time the verdict is computed.
    expect(decideRateLimit(99, 1, 1_000, 1_000).retryAfterSeconds).toBe(1);
    expect(decideRateLimit(99, 1, 1_000, 5_000).retryAfterSeconds).toBe(1);
  });

  it("rounds the wait up so a client never retries early", () => {
    expect(decideRateLimit(2, 1, 1_500, 0).retryAfterSeconds).toBe(2);
    expect(decideRateLimit(2, 1, 1_001, 0).retryAfterSeconds).toBe(2);
  });

  it("counts down remaining as the window fills", () => {
    const remaining = [1, 2, 3, 4, 5].map(
      (count) => decideRateLimit(count, 5, 1000, 0).remaining,
    );
    expect(remaining).toEqual([4, 3, 2, 1, 0]);
  });
});

describe("consumeFallbackRateLimit", () => {
  it("enforces the limit when the database is unavailable", () => {
    // The fallback exists so a database outage degrades to per-instance
    // limiting rather than to no limiting at all.
    const id = `fallback-${randomUUID()}`;
    const resetAt = 10_000;

    expect(consumeFallbackRateLimit(id, 2, resetAt, 0).allowed).toBe(true);
    expect(consumeFallbackRateLimit(id, 2, resetAt, 0).allowed).toBe(true);
    expect(consumeFallbackRateLimit(id, 2, resetAt, 0).allowed).toBe(false);
  });

  it("rolls over once the window passes", () => {
    const id = `fallback-${randomUUID()}`;
    expect(consumeFallbackRateLimit(id, 1, 1_000, 0).allowed).toBe(true);
    expect(consumeFallbackRateLimit(id, 1, 1_000, 500).allowed).toBe(false);
    // New window: caller passes the next resetAt and a `now` beyond the old one.
    expect(consumeFallbackRateLimit(id, 1, 2_000, 1_000).allowed).toBe(true);
  });
});

describe("RATE_LIMITS registry", () => {
  it("declares a positive budget for every named limit", () => {
    const names = Object.keys(RATE_LIMITS);
    expect(names.length).toBeGreaterThan(0);
    for (const [name, limit] of Object.entries(RATE_LIMITS)) {
      expect(limit.max, name).toBeGreaterThan(0);
      expect(limit.windowMs, name).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Database-backed behaviour. Needs TEST_MONGODB_URI; skipped with a warning
// when absent (see src/test/mongo.ts).
// ---------------------------------------------------------------------------

describeWithDatabase("rate limiting against MongoDB", () => {
  useTestDatabase();

  it("allows five contact submissions and blocks the sixth", async () => {
    const key = `test-${randomUUID()}`;
    // Offset from an exact window boundary so retryAfterSeconds is not
    // trivially the whole window.
    const now = HOUR_MS * 100;

    for (let request = 0; request < 5; request += 1) {
      const result = await consumeContactRateLimit(key, now);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - request);
    }

    const blocked = await consumeContactRateLimit(key, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(3600);
  });

  it("opens a new window after the previous one expires", async () => {
    const key = `test-${randomUUID()}`;
    const first = HOUR_MS * 200;
    for (let request = 0; request < 5; request += 1) {
      expect((await consumeContactRateLimit(key, first)).allowed).toBe(true);
    }
    expect((await consumeContactRateLimit(key, first)).allowed).toBe(false);
    expect((await consumeContactRateLimit(key, first + HOUR_MS)).allowed).toBe(
      true,
    );
  });

  it("keeps separate counters per visitor", async () => {
    const now = HOUR_MS * 400;
    const a = `test-${randomUUID()}`;
    const b = `test-${randomUUID()}`;

    for (let request = 0; request < 3; request += 1) {
      expect((await consumeAuditRateLimit(a, now)).allowed).toBe(true);
    }
    expect((await consumeAuditRateLimit(a, now)).allowed).toBe(false);
    expect((await consumeAuditRateLimit(b, now)).allowed).toBe(true);
  });

  it("keeps separate counters per feature for the same visitor", async () => {
    const key = `test-${randomUUID()}`;
    const now = HOUR_MS * 500;

    for (let request = 0; request < 3; request += 1) {
      expect((await consumeAuditRateLimit(key, now)).allowed).toBe(true);
    }
    expect((await consumeAuditRateLimit(key, now)).allowed).toBe(false);
    // Exhausting the audit budget must not touch contact or AI.
    expect((await consumeContactRateLimit(key, now)).allowed).toBe(true);
    expect((await consumeAiRateLimit(key, now)).allowed).toBe(true);
  });

  it("is atomic under concurrency", async () => {
    // Twenty simultaneous requests against a limit of five must yield exactly
    // five allowances. This is the guarantee the in-process Map could not make
    // across instances, and the reason for the whole rewrite.
    const key = `test-${randomUUID()}`;
    const now = HOUR_MS * 600;
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consumeRateLimit({
          bucket: "concurrency",
          key,
          max: 5,
          windowMs: HOUR_MS,
          now,
        }),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(15);
  });

  it("enforces every named limit at its declared maximum", async () => {
    const now = HOUR_MS * 800;
    for (const [name, limit] of Object.entries(RATE_LIMITS)) {
      const key = `test-${randomUUID()}`;
      for (let request = 0; request < limit.max; request += 1) {
        const result = await consumeNamedRateLimit(
          name as keyof typeof RATE_LIMITS,
          key,
          now,
        );
        expect(result.allowed, `${name} request ${request + 1}`).toBe(true);
      }
      expect(
        (
          await consumeNamedRateLimit(
            name as keyof typeof RATE_LIMITS,
            key,
            now,
          )
        ).allowed,
        `${name} over limit`,
      ).toBe(false);
    }
  });
});
