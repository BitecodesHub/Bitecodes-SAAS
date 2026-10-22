import { beforeEach, describe, expect, it } from "vitest";
import type {
  AnalyticsDailyDoc,
  AnalyticsEventRecord,
} from "@/lib/server/db/types";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import {
  buildImprovementSuggestions,
  getAnalyticsOverview,
  type VitalSummary,
} from "@/lib/server/analytics/repository";

const DAY_ONE = new Date("2026-10-18T09:00:00.000Z");

function at(day: "one" | "two", minutes: number): Date {
  const base =
    day === "one"
      ? Date.parse("2026-10-18T09:00:00.000Z")
      : Date.parse("2026-10-19T09:00:00.000Z");
  return new Date(base + minutes * 60_000);
}

function event(
  overrides: Partial<AnalyticsEventRecord> = {},
): AnalyticsEventRecord {
  return {
    type: "pageview",
    path: "/",
    name: null,
    value: null,
    referrerHost: null,
    visitorHash: "v1",
    createdAt: DAY_ONE,
    utm: null,
    ...overrides,
  };
}

function dayOneEvents(): AnalyticsEventRecord[] {
  return [
    event({
      path: "/",
      visitorHash: "v1",
      referrerHost: "www.google.com",
      createdAt: at("one", 0),
    }),
    event({ path: "/pricing", visitorHash: "v1", createdAt: at("one", 1) }),
    event({
      type: "event",
      path: "/pricing",
      name: "cta_click",
      value: 1,
      visitorHash: "v1",
      createdAt: at("one", 2),
    }),
    event({
      type: "event",
      path: "/pricing",
      name: "form_start",
      visitorHash: "v1",
      createdAt: at("one", 3),
    }),
    event({
      type: "event",
      path: "/pricing",
      name: "form_submit",
      visitorHash: "v1",
      createdAt: at("one", 4),
    }),
    event({
      type: "vital",
      path: "/pricing",
      name: "LCP",
      value: 2_000,
      visitorHash: "v1",
      createdAt: at("one", 5),
    }),
    event({ path: "/", visitorHash: "v2", createdAt: at("one", 60) }),
    event({
      type: "vital",
      path: "/",
      name: "LCP",
      value: 5_000,
      visitorHash: "v2",
      createdAt: at("one", 61),
    }),
    event({
      type: "vital",
      path: "/",
      name: "CLS",
      value: 0.3,
      visitorHash: "v2",
      createdAt: at("one", 62),
    }),
    event({ path: "/contact", visitorHash: "v3", createdAt: at("one", 120) }),
    event({
      type: "event",
      path: "/contact",
      name: "form_start",
      visitorHash: "v3",
      createdAt: at("one", 121),
    }),
  ];
}

function dayTwoEvents(): AnalyticsEventRecord[] {
  return [
    event({
      path: "/pricing",
      visitorHash: "v1",
      referrerHost: "www.linkedin.com",
      utm: {
        source: "linkedin",
        medium: "social",
        campaign: "launch",
        term: null,
        content: null,
      },
      createdAt: at("two", 0),
    }),
    event({ path: "/blog", visitorHash: "v4", createdAt: at("two", 60) }),
  ];
}

async function seed(records: AnalyticsEventRecord[]): Promise<void> {
  const { analyticsEvents } = await import("@/lib/server/db/collections");
  await (await analyticsEvents()).insertMany([...records]);
}

describe("buildImprovementSuggestions", () => {
  it("prioritises slow pages, then stalled forms, bounce, and missing campaigns", () => {
    const vitals: VitalSummary[] = [
      {
        metric: "LCP",
        p75: 4_500,
        samples: 40,
        rating: "poor",
      },
    ];
    const suggestions = buildImprovementSuggestions({
      totals: {
        pageviews: 120,
        ctaClicks: 12,
        formStarts: 25,
        formSubmits: 0,
      },
      campaigns: [],
      vitals,
      vitalsByPath: [
        {
          path: "/pricing",
          pageviews: 60,
          metrics: {
            LCP: { p75: 5_200, samples: 12, rating: "poor" },
          },
        },
      ],
      pageEngagement: [{ path: "/blog", visitors: 40, singleViews: 32 }],
    });

    expect(suggestions[0]).toContain("Improve LCP on /pricing");
    expect(suggestions).toContainEqual(
      expect.stringContaining("25 forms were started but none were submitted"),
    );
    expect(suggestions).toContainEqual(
      expect.stringContaining("80% of its visitors viewed only that page"),
    );
    expect(suggestions).toContainEqual(
      expect.stringContaining("No campaign traffic was recorded"),
    );
  });

  it("reports a site-wide metric when no page covers it", () => {
    const suggestions = buildImprovementSuggestions({
      totals: {
        pageviews: 120,
        ctaClicks: 12,
        formStarts: 2,
        formSubmits: 1,
      },
      campaigns: [{ pageviews: 10 }],
      vitals: [{ metric: "LCP", p75: 4_500, samples: 40, rating: "poor" }],
      vitalsByPath: [],
      pageEngagement: [],
    });
    expect(suggestions).toContainEqual(
      expect.stringContaining("Site-wide LCP is poor"),
    );
  });

  it("returns nothing when the data has no clear issue", () => {
    expect(
      buildImprovementSuggestions({
        totals: {
          pageviews: 10,
          ctaClicks: 2,
          formStarts: 2,
          formSubmits: 1,
        },
        campaigns: [{ pageviews: 3 }],
        vitals: [
          {
            metric: "LCP",
            p75: 2_000,
            samples: 5,
            rating: "good",
          },
        ],
        vitalsByPath: [],
        pageEngagement: [],
      }),
    ).toEqual([]);
  });
});

describeWithDatabase("analytics repository", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { analyticsEvents, analyticsDaily, siteSettings } =
      await import("@/lib/server/db/collections");
    await (await analyticsEvents()).deleteMany({});
    await (await analyticsDaily()).deleteMany({});
    await (await siteSettings()).deleteMany({});
  });

  it("builds the dashboard read model from raw events", async () => {
    await seed([...dayOneEvents(), ...dayTwoEvents()]);

    const overview = await getAnalyticsOverview({
      from: new Date("2026-10-18T00:00:00.000Z"),
      to: new Date("2026-10-20T00:00:00.000Z"),
    });

    expect(overview.totals).toEqual({
      visitors: 4,
      pageviews: 6,
      events: 4,
      ctaClicks: 1,
      formStarts: 2,
      formSubmits: 1,
      conversionRate: 25,
    });

    expect(overview.daily).toEqual([
      { date: "2026-10-18", visitors: 3, pageviews: 4 },
      { date: "2026-10-19", visitors: 2, pageviews: 2 },
    ]);

    expect(overview.topPages.find((page) => page.path === "/pricing")).toEqual({
      path: "/pricing",
      pageviews: 2,
      visitors: 1,
    });
    expect(overview.topPages.find((page) => page.path === "/")).toEqual({
      path: "/",
      pageviews: 2,
      visitors: 2,
    });

    expect(overview.sources[0]).toEqual({ source: "direct", pageviews: 4 });
    expect(
      overview.sources.find((source) => source.source === "www.google.com"),
    ).toEqual({ source: "www.google.com", pageviews: 1 });
    expect(
      overview.sources.find((source) => source.source === "www.linkedin.com"),
    ).toEqual({ source: "www.linkedin.com", pageviews: 1 });

    expect(overview.campaigns).toEqual([
      {
        source: "linkedin",
        medium: "social",
        campaign: "launch",
        pageviews: 1,
        visitors: 1,
      },
    ]);

    expect(overview.events.find((row) => row.name === "form_start")).toEqual({
      name: "form_start",
      count: 2,
      visitors: 2,
    });

    expect(overview.funnel.map((stage) => stage.visitors)).toEqual([
      4, 1, 1, 2, 1,
    ]);
    expect(overview.funnel[4]?.fromVisit).toBe(25);

    const lcp = overview.vitals.find((vital) => vital.metric === "LCP");
    expect(lcp).toMatchObject({ p75: 5_000, samples: 2, rating: "poor" });
    const cls = overview.vitals.find((vital) => vital.metric === "CLS");
    expect(cls).toMatchObject({ p75: 0.3, samples: 1, rating: "poor" });
    expect(
      overview.vitals.find((vital) => vital.metric === "FCP"),
    ).toMatchObject({ p75: null, samples: 0, rating: null });

    const slash = overview.vitalsByPath.find((page) => page.path === "/");
    expect(slash?.metrics.LCP).toMatchObject({ p75: 5_000, samples: 1 });
    expect(slash?.metrics.CLS).toMatchObject({ p75: 0.3, samples: 1 });

    // Two samples is below the threshold for a recommendation, so the list is
    // honestly empty rather than guessing from noise.
    expect(overview.improvements).toEqual([]);
  });

  it("rolls a day up idempotently and includes late events on a re-run", async () => {
    await seed(dayOneEvents());

    const { rollupAnalyticsDay } =
      await import("@/lib/server/analytics/repository");
    const first = await rollupAnalyticsDay("2026-10-18");
    expect(first).toMatchObject({
      date: "2026-10-18",
      paths: 3,
      pageviews: 4,
      visitors: 3,
      events: 4,
      upserts: 4,
    });

    const { analyticsDaily } = await import("@/lib/server/db/collections");
    const rows = async () =>
      (await analyticsDaily()).find({ date: "2026-10-18" }).toArray();

    const firstRows = (await rows()) as AnalyticsDailyDoc[];
    expect(firstRows).toHaveLength(4);

    const home = firstRows.find((row) => row.path === "/");
    // The direct visit to "/" and the two internal referrer-free visits are
    // all counted as direct; the host-only rule is what makes that grouping
    // stable.
    expect(home).toMatchObject({
      pageviews: 2,
      visitors: 2,
      referrers: { "www.google.com": 1, direct: 1 },
    });
    expect(home?.vitals).toEqual({
      LCP: { p75: 5_000, samples: 1 },
      CLS: { p75: 0.3, samples: 1 },
    });

    const pricing = firstRows.find((row) => row.path === "/pricing");
    expect(pricing).toMatchObject({
      pageviews: 1,
      visitors: 1,
      events: { cta_click: 1, form_start: 1, form_submit: 1 },
      referrers: { direct: 1 },
      utmSources: {},
      utmCampaigns: {},
    });

    const total = firstRows.find((row) => row.path === "*");
    expect(total).toMatchObject({
      pageviews: 4,
      visitors: 3,
      events: { cta_click: 1, form_start: 2, form_submit: 1 },
      referrers: { direct: 3, "www.google.com": 1 },
    });

    // A second run must not duplicate rows or change their values.
    await rollupAnalyticsDay("2026-10-18");
    expect(await rows()).toHaveLength(4);

    // A late beacon is picked up by a re-run, and a manually inserted stale
    // path is removed.
    await (
      await analyticsDaily()
    ).insertOne({
      date: "2026-10-18",
      path: "/stale",
      pageviews: 99,
      visitors: 99,
      events: {},
      referrers: {},
      utmSources: {},
      utmCampaigns: {},
      vitals: {},
      createdAt: DAY_ONE,
      updatedAt: DAY_ONE,
    });
    await seed([
      event({
        path: "/blog",
        visitorHash: "v4",
        createdAt: new Date("2026-10-18T23:00:00.000Z"),
      }),
    ]);

    const third = await rollupAnalyticsDay("2026-10-18");
    expect(third).toMatchObject({ paths: 4, pageviews: 5, visitors: 4 });
    const finalRows = await rows();
    expect(finalRows).toHaveLength(5);
    expect(finalRows.some((row) => row.path === "/stale")).toBe(false);
    expect(finalRows.find((row) => row.path === "*")?.pageviews).toBe(5);
  });

  it("handles an empty day by writing only the total row", async () => {
    const { rollupAnalyticsDay } =
      await import("@/lib/server/analytics/repository");
    const result = await rollupAnalyticsDay("2026-10-17");
    expect(result).toMatchObject({ paths: 0, pageviews: 0, visitors: 0 });

    const { analyticsDaily } = await import("@/lib/server/db/collections");
    const rows = await (await analyticsDaily())
      .find({ date: "2026-10-17" })
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ path: "*", pageviews: 0, visitors: 0 });
  });

  it("honours the growth toggle, deadline, and date validation in the job", async () => {
    const { handleAnalyticsRollup } =
      await import("@/lib/server/jobs/handlers/analytics-rollup");
    const logs: string[] = [];
    const context = {
      jobId: "job-1",
      attempts: 1,
      log: (message: string) => logs.push(message),
      deadline: Date.now() + 60_000,
    };

    const { siteSettings } = await import("@/lib/server/db/collections");
    await (
      await siteSettings()
    ).updateOne(
      { _id: "site" },
      {
        $set: { growth: { analyticsRollup: false }, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    expect(await handleAnalyticsRollup({}, context)).toEqual({
      skipped: "disabled",
    });

    await (await siteSettings()).deleteMany({});
    expect(
      await handleAnalyticsRollup(
        { date: "2026-10-18" },
        { ...context, deadline: Date.now() + 1_000 },
      ),
    ).toEqual({ skipped: "deadline" });

    expect(
      await handleAnalyticsRollup({ date: "2026-02-30" }, context),
    ).toEqual({ skipped: "invalid-date" });
    expect(
      await handleAnalyticsRollup(
        { date: new Date().toISOString().slice(0, 10) },
        context,
      ),
    ).toEqual({ skipped: "invalid-date" });

    await seed(dayOneEvents());
    const result = await handleAnalyticsRollup({ date: "2026-10-18" }, context);
    expect(result).toMatchObject({
      date: "2026-10-18",
      pageviews: 4,
      visitors: 3,
    });
    expect(logs.length).toBeGreaterThan(0);
  });
});
