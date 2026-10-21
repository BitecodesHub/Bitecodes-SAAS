import "server-only";

import { analyticsDaily, analyticsEvents } from "@/lib/server/db/collections";
import type {
  AnalyticsDailyDoc,
  AnalyticsEventRecord,
} from "@/lib/server/db/types";
import {
  percentile75,
  vitalRating,
  WEB_VITAL_NAMES,
  type VitalRating,
  type WebVitalName,
} from "@/lib/analytics";

/**
 * Storage and read models for first-party analytics.
 *
 * Raw events live in `analytics_events` and expire after 180 days. The daily
 * roll-up copies their totals into `analytics_daily`, one row per UTC date and
 * path, so long-term reporting survives the TTL and a day costs one small
 * document per path instead of one per visit.
 *
 * The dashboard reads raw events for the selected 7, 30, or 90 days. That is
 * inside the retention window and gives exact distinct-visitor counts and
 * percentiles. The roll-up exists for history after raw events expire and for
 * re-runs that include late beacons.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AnalyticsRange {
  /** Inclusive. */
  from: Date;
  /** Exclusive. */
  to: Date;
}

export interface AnalyticsTotals {
  visitors: number;
  pageviews: number;
  events: number;
  ctaClicks: number;
  formStarts: number;
  formSubmits: number;
  /** Form submissions divided by visitors, as a percentage. */
  conversionRate: number;
}

export interface DailyTrafficPoint {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  visitors: number;
  pageviews: number;
}

export interface TopPage {
  path: string;
  pageviews: number;
  visitors: number;
}

export interface TrafficSource {
  /** A referrer host, or "direct" when there was no external referrer. */
  source: string;
  pageviews: number;
}

export interface UtmCampaign {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  pageviews: number;
  visitors: number;
}

export interface EventCount {
  name: string;
  count: number;
  visitors: number;
}

export type FunnelStageKey =
  | "visit"
  | "engaged"
  | "cta_click"
  | "form_start"
  | "lead_submit";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  visitors: number;
  /** Conversion from the previous stage, as a percentage; null for stage one. */
  fromPrevious: number | null;
  /** Conversion from the first stage, as a percentage; null when no visits. */
  fromVisit: number | null;
}

export interface VitalSummary {
  metric: WebVitalName;
  p75: number | null;
  samples: number;
  rating: VitalRating | null;
}

export interface PathVitalSummary {
  path: string;
  pageviews: number;
  metrics: Partial<
    Record<WebVitalName, { p75: number; samples: number; rating: VitalRating }>
  >;
}

export interface AnalyticsOverview {
  totals: AnalyticsTotals;
  daily: DailyTrafficPoint[];
  topPages: TopPage[];
  sources: TrafficSource[];
  campaigns: UtmCampaign[];
  events: EventCount[];
  funnel: FunnelStage[];
  vitals: VitalSummary[];
  vitalsByPath: PathVitalSummary[];
  improvements: string[];
}

export interface AnalyticsOverviewOptions {
  topPagesLimit?: number;
  sourcesLimit?: number;
  campaignsLimit?: number;
  eventsLimit?: number;
  vitalsPathLimit?: number;
}

/** Inserts cleaned events. The caller has already hashed the visitor. */
export async function insertAnalyticsEvents(
  records: readonly AnalyticsEventRecord[],
): Promise<number> {
  if (records.length === 0) return 0;
  const collection = await analyticsEvents();
  const result = await collection.insertMany([...records]);
  return result.insertedCount;
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

interface CountRow {
  value: number;
}

function countOf(rows: CountRow[] | undefined): number {
  return rows?.[0]?.value ?? 0;
}

function percentage(current: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round((current / base) * 1_000) / 10;
}

function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Every UTC day in the window, including days with no events, so the line
 * chart shows a continuous series rather than skipping quiet days.
 */
export function fillDailySeries(
  range: AnalyticsRange,
  rows: readonly { date: string; visitors: number; pageviews: number }[],
): DailyTrafficPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const points: DailyTrafficPoint[] = [];
  const cursor = new Date(
    Date.UTC(
      range.from.getUTCFullYear(),
      range.from.getUTCMonth(),
      range.from.getUTCDate(),
    ),
  );

  while (cursor.getTime() < range.to.getTime()) {
    const date = dateKeyOf(cursor);
    const row = byDate.get(date);
    points.push({
      date,
      visitors: row?.visitors ?? 0,
      pageviews: row?.pageviews ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

/**
 * Scores the read model and returns short, specific actions in plain English.
 *
 * Pure so the rules can be unit-tested without a database. The order is
 * deliberate: a page-level performance problem is more actionable than a
 * site-wide average, a form that starts but never submits is more urgent than
 * a measurement gap, and a missing campaign is last because it is housekeeping
 * rather than a conversion defect.
 */
export function buildImprovementSuggestions(input: {
  totals: Pick<
    AnalyticsTotals,
    "pageviews" | "ctaClicks" | "formStarts" | "formSubmits"
  >;
  campaigns: readonly { pageviews: number }[];
  vitals: readonly VitalSummary[];
  vitalsByPath: readonly PathVitalSummary[];
  pageEngagement: readonly {
    path: string;
    visitors: number;
    singleViews: number;
  }[];
}): string[] {
  const suggestions: string[] = [];

  const pageIssues: { text: string; samples: number }[] = [];
  for (const page of input.vitalsByPath) {
    for (const metric of ["LCP", "INP", "CLS"] as const) {
      const summary = page.metrics[metric];
      if (!summary || summary.rating !== "poor" || summary.samples < 5) {
        continue;
      }
      pageIssues.push({
        samples: summary.samples,
        text: `Improve ${metric} on ${page.path}: the 75th percentile is ${formatMetric(metric, summary.p75)} across ${summary.samples} ${summary.samples === 1 ? "sample" : "samples"}.`,
      });
    }
  }
  pageIssues.sort((a, b) => b.samples - a.samples);
  suggestions.push(...pageIssues.slice(0, 3).map((issue) => issue.text));

  for (const vital of input.vitals) {
    if (vital.rating !== "poor" || vital.samples < 10 || vital.p75 === null) {
      continue;
    }
    if (
      vital.metric !== "LCP" &&
      vital.metric !== "INP" &&
      vital.metric !== "CLS"
    ) {
      continue;
    }
    const covered = pageIssues.some((issue) =>
      issue.text.startsWith(`Improve ${vital.metric} on `),
    );
    if (covered) continue;
    suggestions.push(
      `Site-wide ${vital.metric} is poor: the 75th percentile is ${formatMetric(vital.metric, vital.p75)} across ${vital.samples} samples.`,
    );
  }

  if (input.totals.formStarts >= 20 && input.totals.formSubmits === 0) {
    suggestions.push(
      `${input.totals.formStarts} forms were started but none were submitted. Review validation errors, required fields, and the submit button.`,
    );
  }

  const bouncy = input.pageEngagement
    .filter(
      (page) =>
        page.visitors >= 20 &&
        page.singleViews / Math.max(1, page.visitors) >= 0.7,
    )
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 2);
  for (const page of bouncy) {
    const share = Math.round((page.singleViews / page.visitors) * 100);
    suggestions.push(
      `Review ${page.path}: ${share}% of its visitors viewed only that page.`,
    );
  }

  if (input.totals.pageviews >= 50 && input.campaigns.length === 0) {
    suggestions.push(
      "No campaign traffic was recorded. Add utm_source, utm_medium, and utm_campaign to outbound links.",
    );
  }

  if (input.totals.pageviews >= 100 && input.totals.ctaClicks === 0) {
    suggestions.push(
      "No CTA clicks were recorded. Check that primary buttons carry a data-track attribute.",
    );
  }

  return suggestions.slice(0, 6);
}

function formatMetric(metric: WebVitalName, value: number): string {
  if (metric === "CLS") return value.toFixed(2);
  return `${Math.round(value).toLocaleString("en-US")} ms`;
}

/**
 * The complete dashboard model in one call. Aggregations run in parallel
 * because each is independent and the page should not pay their latencies in
 * sequence.
 */
export async function getAnalyticsOverview(
  range: AnalyticsRange,
  options: AnalyticsOverviewOptions = {},
): Promise<AnalyticsOverview> {
  const {
    topPagesLimit = 8,
    sourcesLimit = 8,
    campaignsLimit = 10,
    eventsLimit = 20,
    vitalsPathLimit = 8,
  } = options;

  if (range.from.getTime() >= range.to.getTime()) {
    throw new Error("The analytics range must start before it ends.");
  }

  const events = await analyticsEvents();
  const match = { createdAt: { $gte: range.from, $lt: range.to } };

  const [totalsRows, dailyRows, pageRows, sourceRows, campaignRows, eventRows] =
    await Promise.all([
      events
        .aggregate<{
          visitors: CountRow[];
          counts: {
            pageviews: number;
            events: number;
            ctaClicks: number;
            formStarts: number;
            formSubmits: number;
          }[];
        }>([
          { $match: match },
          {
            $facet: {
              visitors: [
                { $group: { _id: "$visitorHash" } },
                { $count: "value" },
              ],
              counts: [
                {
                  $group: {
                    _id: null,
                    pageviews: {
                      $sum: { $cond: [{ $eq: ["$type", "pageview"] }, 1, 0] },
                    },
                    events: {
                      $sum: { $cond: [{ $eq: ["$type", "event"] }, 1, 0] },
                    },
                    ctaClicks: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$type", "event"] },
                              { $eq: ["$name", "cta_click"] },
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    formStarts: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$type", "event"] },
                              { $eq: ["$name", "form_start"] },
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    formSubmits: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$type", "event"] },
                              {
                                $in: ["$name", ["form_submit", "lead_submit"]],
                              },
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        ])
        .toArray(),
      events
        .aggregate<{ date: string; pageviews: number; visitors: number }>([
          { $match: match },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                  timezone: "UTC",
                },
              },
              pageviews: {
                $sum: { $cond: [{ $eq: ["$type", "pageview"] }, 1, 0] },
              },
              visitorHashes: { $addToSet: "$visitorHash" },
            },
          },
          {
            $project: {
              _id: 0,
              date: "$_id",
              pageviews: 1,
              visitors: { $size: "$visitorHashes" },
            },
          },
          { $sort: { date: 1 } },
        ])
        .toArray(),
      events
        .aggregate<{ path: string; pageviews: number; visitors: number }>([
          { $match: { ...match, type: "pageview" } },
          {
            $group: {
              _id: "$path",
              pageviews: { $sum: 1 },
              visitorHashes: { $addToSet: "$visitorHash" },
            },
          },
          {
            $project: {
              _id: 0,
              path: "$_id",
              pageviews: 1,
              visitors: { $size: "$visitorHashes" },
            },
          },
          { $sort: { pageviews: -1 } },
          { $limit: topPagesLimit },
        ])
        .toArray(),
      events
        .aggregate<{ _id: string; pageviews: number }>([
          { $match: { ...match, type: "pageview" } },
          {
            $group: {
              _id: { $ifNull: ["$referrerHost", "direct"] },
              pageviews: { $sum: 1 },
            },
          },
          { $sort: { pageviews: -1 } },
          { $limit: sourcesLimit },
        ])
        .toArray(),
      events
        .aggregate<{
          _id: {
            source: string | null;
            medium: string | null;
            campaign: string | null;
          };
          pageviews: number;
          visitors: number;
        }>([
          {
            $match: { ...match, type: "pageview", "utm.source": { $ne: null } },
          },
          {
            $group: {
              _id: {
                source: "$utm.source",
                medium: "$utm.medium",
                campaign: "$utm.campaign",
              },
              pageviews: { $sum: 1 },
              visitorHashes: { $addToSet: "$visitorHash" },
            },
          },
          {
            $project: {
              _id: 1,
              pageviews: 1,
              visitors: { $size: "$visitorHashes" },
            },
          },
          { $sort: { pageviews: -1 } },
          { $limit: campaignsLimit },
        ])
        .toArray(),
      events
        .aggregate<{ name: string; count: number; visitors: number }>([
          { $match: { ...match, type: "event", name: { $ne: null } } },
          {
            $group: {
              _id: "$name",
              count: { $sum: 1 },
              visitorHashes: { $addToSet: "$visitorHash" },
            },
          },
          {
            $project: {
              _id: 0,
              name: "$_id",
              count: 1,
              visitors: { $size: "$visitorHashes" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: eventsLimit },
        ])
        .toArray(),
    ]);

  const [funnelRows, vitalRows, vitalPathRows, engagementRows] =
    await Promise.all([
      events
        .aggregate<{
          visit: CountRow[];
          engaged: CountRow[];
          cta: CountRow[];
          formStart: CountRow[];
          lead: CountRow[];
        }>([
          { $match: match },
          {
            $facet: {
              visit: [
                { $match: { type: "pageview" } },
                { $group: { _id: "$visitorHash" } },
                { $count: "value" },
              ],
              engaged: [
                { $match: { type: "pageview" } },
                {
                  $group: {
                    _id: "$visitorHash",
                    pageviews: { $sum: 1 },
                  },
                },
                { $match: { pageviews: { $gte: 2 } } },
                { $count: "value" },
              ],
              cta: [
                { $match: { type: "event", name: "cta_click" } },
                { $group: { _id: "$visitorHash" } },
                { $count: "value" },
              ],
              formStart: [
                { $match: { type: "event", name: "form_start" } },
                { $group: { _id: "$visitorHash" } },
                { $count: "value" },
              ],
              lead: [
                {
                  $match: {
                    type: "event",
                    name: { $in: ["form_submit", "lead_submit"] },
                  },
                },
                { $group: { _id: "$visitorHash" } },
                { $count: "value" },
              ],
            },
          },
        ])
        .toArray(),
      events
        .aggregate<{ _id: string; values: number[] }>([
          {
            $match: {
              ...match,
              type: "vital",
              name: { $in: [...WEB_VITAL_NAMES] },
              value: { $ne: null },
            },
          },
          { $group: { _id: "$name", values: { $push: "$value" } } },
        ])
        .toArray(),
      events
        .aggregate<{
          _id: { path: string; name: string };
          values: number[];
        }>([
          {
            $match: {
              ...match,
              type: "vital",
              name: { $in: [...WEB_VITAL_NAMES] },
              value: { $ne: null },
            },
          },
          {
            $group: {
              _id: { path: "$path", name: "$name" },
              values: { $push: "$value" },
            },
          },
        ])
        .toArray(),
      events
        .aggregate<{
          _id: string;
          visitors: number;
          singleViews: number;
        }>([
          { $match: { ...match, type: "pageview" } },
          {
            $group: {
              _id: { path: "$path", visitor: "$visitorHash" },
              pageviews: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: "$_id.path",
              visitors: { $sum: 1 },
              singleViews: {
                $sum: { $cond: [{ $eq: ["$pageviews", 1] }, 1, 0] },
              },
            },
          },
          { $sort: { visitors: -1 } },
          { $limit: 30 },
        ])
        .toArray(),
    ]);

  const counts = totalsRows[0]?.counts[0];
  const totals: AnalyticsTotals = {
    visitors: countOf(totalsRows[0]?.visitors),
    pageviews: counts?.pageviews ?? 0,
    events: counts?.events ?? 0,
    ctaClicks: counts?.ctaClicks ?? 0,
    formStarts: counts?.formStarts ?? 0,
    formSubmits: counts?.formSubmits ?? 0,
    conversionRate: 0,
  };
  totals.conversionRate = percentage(totals.formSubmits, totals.visitors) ?? 0;

  const daily = fillDailySeries(
    range,
    dailyRows.map((row) => ({
      date: row.date,
      pageviews: row.pageviews,
      visitors: row.visitors,
    })),
  );

  const topPages: TopPage[] = pageRows.map((row) => ({
    path: row.path,
    pageviews: row.pageviews,
    visitors: row.visitors,
  }));

  const sources: TrafficSource[] = sourceRows.map((row) => ({
    source: row._id,
    pageviews: row.pageviews,
  }));

  const campaigns: UtmCampaign[] = campaignRows.map((row) => ({
    source: row._id.source,
    medium: row._id.medium,
    campaign: row._id.campaign,
    pageviews: row.pageviews,
    visitors: row.visitors,
  }));

  const eventCounts: EventCount[] = eventRows.map((row) => ({
    name: row.name,
    count: row.count,
    visitors: row.visitors,
  }));

  const funnelFacet = funnelRows[0];
  const stageValues: {
    key: FunnelStageKey;
    label: string;
    visitors: number;
  }[] = [
    {
      key: "visit",
      label: "Visited a page",
      visitors: countOf(funnelFacet?.visit),
    },
    {
      key: "engaged",
      label: "Viewed two or more pages",
      visitors: countOf(funnelFacet?.engaged),
    },
    {
      key: "cta_click",
      label: "Clicked a call to action",
      visitors: countOf(funnelFacet?.cta),
    },
    {
      key: "form_start",
      label: "Started a form",
      visitors: countOf(funnelFacet?.formStart),
    },
    {
      key: "lead_submit",
      label: "Submitted a lead form",
      visitors: countOf(funnelFacet?.lead),
    },
  ];

  const visitCount = stageValues[0]?.visitors ?? 0;
  const funnel: FunnelStage[] = stageValues.map((stage, index) => ({
    ...stage,
    fromPrevious:
      index === 0
        ? null
        : percentage(stage.visitors, stageValues[index - 1]?.visitors ?? 0),
    fromVisit: percentage(stage.visitors, visitCount),
  }));

  const vitals: VitalSummary[] = WEB_VITAL_NAMES.map((metric) => {
    const row = vitalRows.find((entry) => entry._id === metric);
    const p75 = percentile75(row?.values ?? []);
    return {
      metric,
      p75,
      samples: row?.values.length ?? 0,
      rating: p75 === null ? null : vitalRating(metric, p75),
    };
  });

  const vitalsByPathMap = new Map<string, PathVitalSummary["metrics"]>();
  for (const row of vitalPathRows) {
    const metric = row._id.name as WebVitalName;
    if (!WEB_VITAL_NAMES.includes(metric)) continue;
    const p75 = percentile75(row.values);
    if (p75 === null) continue;
    const entry = vitalsByPathMap.get(row._id.path) ?? {};
    entry[metric] = {
      p75,
      samples: row.values.length,
      rating: vitalRating(metric, p75),
    };
    vitalsByPathMap.set(row._id.path, entry);
  }

  const vitalsByPath: PathVitalSummary[] = topPages
    .slice(0, vitalsPathLimit)
    .map((page) => ({
      path: page.path,
      pageviews: page.pageviews,
      metrics: vitalsByPathMap.get(page.path) ?? {},
    }));

  const pageEngagement = engagementRows.map((row) => ({
    path: row._id,
    visitors: row.visitors,
    singleViews: row.singleViews,
  }));

  return {
    totals,
    daily,
    topPages,
    sources,
    campaigns,
    events: eventCounts,
    funnel,
    vitals,
    vitalsByPath,
    improvements: buildImprovementSuggestions({
      totals,
      campaigns,
      vitals,
      vitalsByPath,
      pageEngagement,
    }),
  };
}

// ---------------------------------------------------------------------------
// Daily roll-up
// ---------------------------------------------------------------------------

export interface RollupResult {
  date: string;
  paths: number;
  pageviews: number;
  visitors: number;
  events: number;
  upserts: number;
}

interface RollupFacet {
  pageviews: { path: string; pageviews: number; visitors: number }[];
  visitorCount: CountRow[];
  events: { _id: { path: string; name: string | null }; count: number }[];
  referrers: {
    _id: { path: string; referrer: string | null };
    count: number;
  }[];
  utmSources: { _id: { path: string; source: string | null }; count: number }[];
  utmCampaigns: {
    _id: { path: string; campaign: string | null };
    count: number;
  }[];
  vitals: { _id: { path: string; name: string }; values: number[] }[];
  vitalsTotal: { _id: string; values: number[] }[];
}

function assertDateKey(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid analytics date: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || dateKeyOf(parsed) !== value) {
    throw new Error(`Invalid analytics date: ${value}`);
  }
}

function addCount(
  target: Record<string, number>,
  key: string | null | undefined,
  count: number,
): void {
  if (!key) return;
  target[key] = (target[key] ?? 0) + count;
}

function p75Map(
  rows: readonly { _id: string; values: number[] }[],
): Record<string, { p75: number; samples: number }> {
  const result: Record<string, { p75: number; samples: number }> = {};
  for (const row of rows) {
    const p75 = percentile75(row.values);
    if (p75 === null) continue;
    result[row._id] = { p75, samples: row.values.length };
  }
  return result;
}

/**
 * Aggregates one UTC day into `analytics_daily`.
 *
 * Idempotent by design: every row is an upsert keyed on (date, path), so the
 * daily job can run twice, or be re-run later to include late beacons, without
 * double counting. Rows for paths that no longer appear are removed, which
 * keeps a corrected re-run exact rather than additive.
 */
export async function rollupAnalyticsDay(
  date: string,
  options: { now?: Date } = {},
): Promise<RollupResult> {
  assertDateKey(date);
  const from = new Date(`${date}T00:00:00.000Z`);
  const to = new Date(from.getTime() + DAY_MS);
  const now = options.now ?? new Date();

  const events = await analyticsEvents();
  const [facet] = await events
    .aggregate<RollupFacet>([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      {
        $facet: {
          pageviews: [
            { $match: { type: "pageview" } },
            {
              $group: {
                _id: "$path",
                pageviews: { $sum: 1 },
                hashes: { $addToSet: "$visitorHash" },
              },
            },
            {
              $project: {
                _id: 0,
                path: "$_id",
                pageviews: 1,
                visitors: { $size: "$hashes" },
              },
            },
          ],
          visitorCount: [
            { $group: { _id: "$visitorHash" } },
            { $count: "value" },
          ],
          events: [
            { $match: { type: "event", name: { $ne: null } } },
            {
              $group: {
                _id: { path: "$path", name: "$name" },
                count: { $sum: 1 },
              },
            },
          ],
          referrers: [
            { $match: { type: "pageview" } },
            {
              $group: {
                _id: { path: "$path", referrer: "$referrerHost" },
                count: { $sum: 1 },
              },
            },
          ],
          utmSources: [
            { $match: { type: "pageview", "utm.source": { $ne: null } } },
            {
              $group: {
                _id: { path: "$path", source: "$utm.source" },
                count: { $sum: 1 },
              },
            },
          ],
          utmCampaigns: [
            { $match: { type: "pageview", "utm.campaign": { $ne: null } } },
            {
              $group: {
                _id: { path: "$path", campaign: "$utm.campaign" },
                count: { $sum: 1 },
              },
            },
          ],
          vitals: [
            {
              $match: {
                type: "vital",
                name: { $in: [...WEB_VITAL_NAMES] },
                value: { $ne: null },
              },
            },
            {
              $group: {
                _id: { path: "$path", name: "$name" },
                values: { $push: "$value" },
              },
            },
          ],
          vitalsTotal: [
            {
              $match: {
                type: "vital",
                name: { $in: [...WEB_VITAL_NAMES] },
                value: { $ne: null },
              },
            },
            { $group: { _id: "$name", values: { $push: "$value" } } },
          ],
        },
      },
    ])
    .toArray();

  const paths = new Set<string>();
  const pageviewsByPath = new Map<string, number>();
  const visitorsByPath = new Map<string, number>();
  const eventsByPath = new Map<string, Record<string, number>>();
  const referrersByPath = new Map<string, Record<string, number>>();
  const utmSourcesByPath = new Map<string, Record<string, number>>();
  const utmCampaignsByPath = new Map<string, Record<string, number>>();
  const vitalsByPath = new Map<
    string,
    Record<string, { p75: number; samples: number }>
  >();

  for (const row of facet?.pageviews ?? []) {
    paths.add(row.path);
    pageviewsByPath.set(row.path, row.pageviews);
    visitorsByPath.set(row.path, row.visitors);
  }

  const totalEvents: Record<string, number> = {};
  for (const row of facet?.events ?? []) {
    paths.add(row._id.path);
    if (!row._id.name) continue;
    const map = eventsByPath.get(row._id.path) ?? {};
    addCount(map, row._id.name, row.count);
    eventsByPath.set(row._id.path, map);
    addCount(totalEvents, row._id.name, row.count);
  }

  const totalReferrers: Record<string, number> = {};
  for (const row of facet?.referrers ?? []) {
    paths.add(row._id.path);
    const map = referrersByPath.get(row._id.path) ?? {};
    addCount(map, row._id.referrer ?? "direct", row.count);
    referrersByPath.set(row._id.path, map);
    addCount(totalReferrers, row._id.referrer ?? "direct", row.count);
  }

  const totalUtmSources: Record<string, number> = {};
  for (const row of facet?.utmSources ?? []) {
    paths.add(row._id.path);
    const map = utmSourcesByPath.get(row._id.path) ?? {};
    addCount(map, row._id.source, row.count);
    utmSourcesByPath.set(row._id.path, map);
    addCount(totalUtmSources, row._id.source, row.count);
  }

  const totalUtmCampaigns: Record<string, number> = {};
  for (const row of facet?.utmCampaigns ?? []) {
    paths.add(row._id.path);
    const map = utmCampaignsByPath.get(row._id.path) ?? {};
    addCount(map, row._id.campaign, row.count);
    utmCampaignsByPath.set(row._id.path, map);
    addCount(totalUtmCampaigns, row._id.campaign, row.count);
  }

  const totalVitals = p75Map(facet?.vitalsTotal ?? []);
  for (const row of facet?.vitals ?? []) {
    paths.add(row._id.path);
    const p75 = percentile75(row.values);
    if (p75 === null) continue;
    const map = vitalsByPath.get(row._id.path) ?? {};
    map[row._id.name] = { p75, samples: row.values.length };
    vitalsByPath.set(row._id.path, map);
  }

  const totalPageviews = [...pageviewsByPath.values()].reduce(
    (sum, count) => sum + count,
    0,
  );

  const collection = await analyticsDaily();
  const documents: Omit<AnalyticsDailyDoc, "_id">[] = [];

  for (const path of paths) {
    documents.push({
      date,
      path,
      pageviews: pageviewsByPath.get(path) ?? 0,
      visitors: visitorsByPath.get(path) ?? 0,
      events: eventsByPath.get(path) ?? {},
      referrers: referrersByPath.get(path) ?? {},
      utmSources: utmSourcesByPath.get(path) ?? {},
      utmCampaigns: utmCampaignsByPath.get(path) ?? {},
      vitals: vitalsByPath.get(path) ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }

  documents.push({
    date,
    path: "*",
    pageviews: totalPageviews,
    visitors: countOf(facet?.visitorCount),
    events: totalEvents,
    referrers: totalReferrers,
    utmSources: totalUtmSources,
    utmCampaigns: totalUtmCampaigns,
    vitals: totalVitals,
    createdAt: now,
    updatedAt: now,
  });

  if (documents.length > 0) {
    await collection.bulkWrite(
      documents.map((document) => ({
        updateOne: {
          filter: { date: document.date, path: document.path },
          update: {
            $set: {
              pageviews: document.pageviews,
              visitors: document.visitors,
              events: document.events,
              referrers: document.referrers,
              utmSources: document.utmSources,
              utmCampaigns: document.utmCampaigns,
              vitals: document.vitals,
              updatedAt: document.updatedAt,
            },
            $setOnInsert: {
              date: document.date,
              path: document.path,
              createdAt: document.createdAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  // A re-run that sees fewer paths (after a bad batch was removed) must not
  // leave yesterday's stale rows behind.
  await collection.deleteMany({
    date,
    path: { $nin: [...paths, "*"] },
  });

  return {
    date,
    paths: paths.size,
    pageviews: totalPageviews,
    visitors: countOf(facet?.visitorCount),
    events: Object.values(totalEvents).reduce((sum, count) => sum + count, 0),
    upserts: documents.length,
  };
}
