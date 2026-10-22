import { describe, expect, it } from "vitest";
import {
  analyticsBatchSchema,
  analyticsVisitorHash,
  cleanAnalyticsName,
  cleanAnalyticsPath,
  cleanReferrerHost,
  doNotTrackEnabled,
  isBotUserAgent,
  resolveAnalyticsTime,
  toAnalyticsEventRecords,
} from "@/lib/server/analytics/ingest";

const SECRET = "test-secret-at-least-32-characters-long-000";
const NOW = Date.parse("2026-10-20T12:00:00.000Z");

describe("analytics bot and privacy gates", () => {
  it("recognises browsers and excludes automation", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isBotUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)"),
    ).toBe(true);
    expect(isBotUserAgent("HeadlessChrome/131.0")).toBe(true);
    expect(isBotUserAgent("curl/8.7.1")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });

  it("reads Do Not Track and Global Privacy Control headers", () => {
    expect(doNotTrackEnabled(new Headers({ dnt: "1" }))).toBe(true);
    expect(doNotTrackEnabled(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(doNotTrackEnabled(new Headers({ dnt: "0", "sec-gpc": "0" }))).toBe(
      false,
    );
    expect(doNotTrackEnabled(new Headers())).toBe(false);
  });
});

describe("analytics input cleaning", () => {
  it("keeps a path and removes its query and fragment", () => {
    expect(cleanAnalyticsPath("/pricing?email=a@b.com#plans")).toBe("/pricing");
    expect(cleanAnalyticsPath(" https://example.com/path ")).toBeNull();
    expect(cleanAnalyticsPath("no-slash")).toBeNull();
    expect(cleanAnalyticsPath("/contact?email=a@b.com")).toBe("/contact");
  });

  it("keeps only a referrer host, never its path", () => {
    expect(
      cleanReferrerHost("https://www.google.com/search?q=private+query"),
    ).toBe("www.google.com");
    expect(cleanReferrerHost("WWW.LinkedIn.com/in/someone")).toBe(
      "www.linkedin.com",
    );
    expect(cleanReferrerHost("www.bitecodes.com", "bitecodes.com")).toBeNull();
    expect(cleanReferrerHost("javascript:alert(1)")).toBeNull();
    expect(cleanReferrerHost("")).toBeNull();
  });

  it("normalises event names and rejects control characters", () => {
    expect(cleanAnalyticsName("  CTA_Click ")).toBe("cta_click");
    expect(cleanAnalyticsName("form_start:v2")).toBe("form_start:v2");
    expect(cleanAnalyticsName("bad name")).toBeNull();
    expect(cleanAnalyticsName("<script>")).toBeNull();
    expect(cleanAnalyticsName("x".repeat(81))).toBeNull();
  });

  it("accepts a plausible client clock and replaces an implausible one", () => {
    expect(resolveAnalyticsTime(NOW - 1_000, NOW).toISOString()).toBe(
      "2026-10-20T11:59:59.000Z",
    );
    expect(resolveAnalyticsTime(NOW + 60 * 60 * 1000, NOW).toISOString()).toBe(
      "2026-10-20T12:00:00.000Z",
    );
    expect(
      resolveAnalyticsTime(NOW - 72 * 60 * 60 * 1000, NOW).toISOString(),
    ).toBe("2026-10-20T12:00:00.000Z");
    expect(resolveAnalyticsTime(undefined, NOW).toISOString()).toBe(
      "2026-10-20T12:00:00.000Z",
    );
  });
});

describe("analyticsVisitorHash", () => {
  it("is stable within a day, rotates across days, and hides its inputs", () => {
    const base = { ip: "203.0.113.9", userAgent: "Mozilla/5.0 test" };
    const first = analyticsVisitorHash({
      ...base,
      date: "2026-10-20",
      secret: SECRET,
    });
    const again = analyticsVisitorHash({
      ...base,
      date: "2026-10-20",
      secret: SECRET,
    });
    const tomorrow = analyticsVisitorHash({
      ...base,
      date: "2026-10-21",
      secret: SECRET,
    });
    const otherSecret = analyticsVisitorHash({
      ...base,
      date: "2026-10-20",
      secret: `${SECRET}-different`,
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(again);
    expect(tomorrow).not.toBe(first);
    expect(otherSecret).not.toBe(first);
    expect(first).not.toContain("203.0.113");
    expect(first).not.toContain("Mozilla");
  });
});

describe("analyticsBatchSchema", () => {
  it("rejects unknown fields and oversized batches", () => {
    expect(
      analyticsBatchSchema.safeParse({
        events: [{ type: "pageview", path: "/", extra: true }],
      }).success,
    ).toBe(false);

    expect(
      analyticsBatchSchema.safeParse({
        events: Array.from({ length: 21 }, () => ({
          type: "pageview",
          path: "/",
        })),
      }).success,
    ).toBe(false);

    expect(
      analyticsBatchSchema.safeParse({
        events: [{ type: "event", path: "/", name: "cta_click" }],
      }).success,
    ).toBe(true);
  });

  it("requires a name for custom events and a known metric for vitals", () => {
    expect(
      analyticsBatchSchema.safeParse({
        events: [{ type: "event", path: "/" }],
      }).success,
    ).toBe(false);
    expect(
      analyticsBatchSchema.safeParse({
        events: [{ type: "vital", path: "/", name: "FID", value: 100 }],
      }).success,
    ).toBe(false);
    expect(
      analyticsBatchSchema.safeParse({
        events: [{ type: "vital", path: "/", name: "LCP", value: 1_800 }],
      }).success,
    ).toBe(true);
  });
});

describe("toAnalyticsEventRecords", () => {
  const batch = analyticsBatchSchema.parse({
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
          content: null,
        },
        ts: NOW - 1_000,
      },
      { type: "event", path: "/pricing", name: "CTA_Click", value: 1 },
      { type: "vital", path: "/pricing", name: "lcp", value: 2_400 },
      { type: "event", path: "/pricing", name: "bad name" },
    ],
  });

  it("cleans each record and drops the ones that cannot be made safe", () => {
    const records = toAnalyticsEventRecords(batch, {
      visitorHash: "a".repeat(64),
      now: NOW,
      ownHost: "www.bitecodes.com",
    });

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({
      type: "pageview",
      path: "/pricing",
      name: null,
      value: null,
      referrerHost: "www.google.com",
      utm: {
        source: "linkedin",
        medium: "social",
        campaign: "launch",
        term: null,
        content: null,
      },
    });
    expect(records[0]?.createdAt.toISOString()).toBe(
      "2026-10-20T11:59:59.000Z",
    );
    expect(records[1]).toMatchObject({
      type: "event",
      name: "cta_click",
      value: 1,
      referrerHost: null,
    });
    expect(records[2]).toMatchObject({
      type: "vital",
      name: "LCP",
      value: 2_400,
    });

    for (const record of records) {
      expect(record.visitorHash).toBe("a".repeat(64));
      expect(JSON.stringify(record)).not.toContain("secret@example.com");
    }
  });
});
