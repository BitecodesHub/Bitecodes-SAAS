import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { RATE_LIMITS, resolveWindow } from "@/lib/server/rate-limit";
import type { AnalyticsEventRecord } from "@/lib/server/db/types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IP = "203.0.113.9";

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://www.bitecodes.com/api/analytics", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": BROWSER_UA,
      "x-forwarded-for": IP,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describeWithDatabase("POST /api/analytics", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { analyticsEvents, rateLimits } =
      await import("@/lib/server/db/collections");
    await (await analyticsEvents()).deleteMany({});
    await (await rateLimits()).deleteMany({});
  });

  it("stores a clean batch without raw IP, user agent, query, or full referrer", async () => {
    const { POST } = await import("@/app/api/analytics/route");
    const ts = Date.now() - 1_000;
    const response = await POST(
      makeRequest({
        events: [
          {
            type: "pageview",
            path: "/pricing?email=secret@example.com",
            referrerHost: "https://www.google.com/search?q=secret",
            utm: {
              source: "linkedin",
              medium: "social",
              campaign: "launch",
              term: null,
              content: "hero",
            },
            ts,
          },
          {
            type: "event",
            path: "/pricing",
            name: "cta_click",
            value: 1,
            ts,
          },
          { type: "vital", path: "/pricing", name: "LCP", value: 1_800, ts },
        ],
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const { analyticsEvents } = await import("@/lib/server/db/collections");
    const docs = (await (await analyticsEvents())
      .find({})
      .toArray()) as AnalyticsEventRecord[];

    expect(docs).toHaveLength(3);
    expect(new Set(docs.map((doc) => doc.visitorHash)).size).toBe(1);
    for (const doc of docs) {
      expect(doc.visitorHash).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.path).toBe("/pricing");
      expect(doc.createdAt.getTime()).toBe(ts);
      expect(JSON.stringify(doc)).not.toContain("203.0.113.9");
      expect(JSON.stringify(doc)).not.toContain("Mozilla");
      expect(JSON.stringify(doc)).not.toContain("secret@example.com");
      expect(JSON.stringify(doc)).not.toContain("search?q");
    }

    const pageview = docs.find((doc) => doc.type === "pageview");
    expect(pageview?.referrerHost).toBe("www.google.com");
    expect(pageview?.utm).toEqual({
      source: "linkedin",
      medium: "social",
      campaign: "launch",
      term: null,
      content: "hero",
    });
  });

  it("stores nothing for bots, Do Not Track, or Global Privacy Control", async () => {
    const { POST } = await import("@/app/api/analytics/route");
    const body = {
      events: [{ type: "pageview", path: "/" }],
    };

    const bot = await POST(
      makeRequest(body, {
        "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      }),
    );
    const dnt = await POST(makeRequest(body, { dnt: "1" }));
    const gpc = await POST(makeRequest(body, { "sec-gpc": "1" }));
    const crossSite = await POST(
      makeRequest(body, { "sec-fetch-site": "cross-site" }),
    );

    expect([bot.status, dnt.status, gpc.status, crossSite.status]).toEqual([
      204, 204, 204, 204,
    ]);

    const { analyticsEvents } = await import("@/lib/server/db/collections");
    expect(await (await analyticsEvents()).countDocuments({})).toBe(0);
  });

  it("rejects malformed, oversized, and invalid batches", async () => {
    const { POST } = await import("@/app/api/analytics/route");

    expect((await POST(makeRequest({ events: [] }))).status).toBe(400);
    expect(
      (
        await POST(
          makeRequest({
            events: Array.from({ length: 21 }, () => ({
              type: "pageview",
              path: "/",
            })),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          makeRequest({
            events: [{ type: "pageview", path: "/", extra: "field" }],
          }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(makeRequest("not json"))).status).toBe(400);
    expect(
      (
        await POST(
          makeRequest({
            events: [{ type: "vital", path: "/", name: "FID", value: 10 }],
          }),
        )
      ).status,
    ).toBe(400);

    // A declared length is rejected before the body is read.
    const oversized = await POST(
      makeRequest(
        { events: [{ type: "pageview", path: "/" }] },
        { "content-length": "20000" },
      ),
    );
    expect(oversized.status).toBe(413);

    // A chunked request can omit content-length; the decoded body is still
    // capped before parsing.
    const chunkedBody = "x".repeat(17_000);
    const chunked = makeRequest(chunkedBody);
    chunked.headers.delete("content-length");
    expect((await POST(chunked)).status).toBe(413);

    const { analyticsEvents } = await import("@/lib/server/db/collections");
    expect(await (await analyticsEvents()).countDocuments({})).toBe(0);
  });

  it("returns 429 when the named analytics limit is exhausted", async () => {
    const now = Date.now();
    const key = createHash("sha256").update(`analytics:${IP}`).digest("hex");
    const window = resolveWindow(
      "analytics",
      key,
      RATE_LIMITS.analytics.windowMs,
      now,
    );
    const { rateLimits } = await import("@/lib/server/db/collections");
    await (
      await rateLimits()
    ).insertOne({
      _id: window.id,
      count: RATE_LIMITS.analytics.max,
      resetAt: new Date(window.resetAtMs),
      expiresAt: new Date(window.resetAtMs + 60_000),
    });

    const { POST } = await import("@/app/api/analytics/route");
    const response = await POST(
      makeRequest({ events: [{ type: "pageview", path: "/" }] }),
    );

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);

    const { analyticsEvents } = await import("@/lib/server/db/collections");
    expect(await (await analyticsEvents()).countDocuments({})).toBe(0);
  });
});
