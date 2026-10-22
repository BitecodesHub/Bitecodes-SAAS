import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, LineChart, StatTile } from "@/components/ui/chart";
import {
  WEB_VITAL_THRESHOLDS,
  formatVital,
  type VitalRating,
  type WebVitalName,
} from "@/lib/analytics";
import {
  getAnalyticsOverview,
  type PathVitalSummary,
} from "@/lib/server/analytics/repository";
import { requireCapability } from "@/lib/server/auth/dal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

/**
 * First-party traffic, funnel, and field performance.
 *
 * Reads raw events for the selected window (7, 30, or 90 days, all inside the
 * 180-day retention). Dates are UTC everywhere so the dashboard, the daily
 * roll-up, and the digest describe the same day.
 *
 * The page is deliberately static in structure and dynamic only in data: a
 * range is a plain link, so every view is shareable and survives a refresh.
 */

const RANGE_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type RangeDays = (typeof RANGE_OPTIONS)[number]["days"];

function parseDays(value: string | undefined): RangeDays {
  const days = Number(value);
  if (days === 30 || days === 90) return days;
  return 7;
}

function buildRange(days: RangeDays, now = new Date()) {
  return {
    // The window starts at 00:00 UTC, so the first and last days are whole
    // days rather than a rolling 168-hour block that changes every minute.
    from: new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - (days - 1),
      ),
    ),
    to: now,
  };
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const RATING_LABEL: Record<VitalRating, string> = {
  good: "Good",
  "needs-improvement": "Needs improvement",
  poor: "Poor",
};

const RATING_CLASS: Record<VitalRating, string> = {
  good: "text-[var(--chart-good)]",
  "needs-improvement": "text-[var(--chart-warning)]",
  poor: "text-destructive",
};

function metricName(metric: WebVitalName): string {
  return WEB_VITAL_THRESHOLDS[metric].label;
}

function VitalCell({
  metric,
  data,
}: {
  metric: WebVitalName;
  data: PathVitalSummary["metrics"][WebVitalName];
}) {
  if (!data) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn("font-medium tabular-nums", RATING_CLASS[data.rating])}
      title={`${data.samples} sample${data.samples === 1 ? "" : "s"}`}
    >
      {formatVital(metric, data.p75)}
    </span>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requireCapability("view");

  const params = await searchParams;
  const rawDays = Array.isArray(params.days) ? params.days[0] : params.days;
  const days = parseDays(rawDays);
  const range = buildRange(days);
  const overview = await getAnalyticsOverview(range);
  const hasTraffic =
    overview.totals.pageviews > 0 ||
    overview.totals.events > 0 ||
    overview.vitals.some((vital) => vital.samples > 0);
  const visitCount = overview.funnel[0]?.visitors ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            First-party, cookieless traffic and conversion data for the public
            site. Visitors are counted with a daily-rotating hash, so the same
            person on two days counts once on each. All dates are UTC.
          </p>
        </div>

        <nav aria-label="Date range" className="flex items-center gap-1">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.days}
              href={`/admin/analytics?days=${option.days}`}
              aria-current={days === option.days ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium transition-colors",
                days === option.days
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </header>

      {!hasTraffic && (
        <div className="border-border bg-surface-2 text-muted-foreground rounded-2xl border p-5 text-sm leading-relaxed">
          No analytics events were recorded in this period. The beacon starts
          collecting page views, clicks, form events, and Web Vitals as soon as
          visitors use the public site.
        </div>
      )}

      <section
        aria-label="Key metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <StatTile
          label="Visitors"
          value={overview.totals.visitors}
          hint="Distinct daily hashes."
        />
        <StatTile label="Page views" value={overview.totals.pageviews} />
        <StatTile
          label="CTA clicks"
          value={overview.totals.ctaClicks}
          hint="Tracked links and buttons, excluding utility controls."
        />
        <StatTile
          label="Form starts"
          value={overview.totals.formStarts}
          hint="First interaction with a tracked form."
        />
        <StatTile
          label="Form submissions"
          value={overview.totals.formSubmits}
          hint="Tracked form submits, including lead forms."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <LineChart
            title="Traffic by day"
            labels={overview.daily.map((point) =>
              DAY_LABEL.format(new Date(`${point.date}T00:00:00.000Z`)),
            )}
            series={[
              {
                name: "Visitors",
                values: overview.daily.map((point) => point.visitors),
              },
              {
                name: "Page views",
                values: overview.daily.map((point) => point.pageviews),
              },
            ]}
          />
        </div>

        <div className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="font-semibold tracking-tight">What to improve</h2>
          {overview.improvements.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              {hasTraffic
                ? "No clear issue stands out in this period. Keep watching the field data as traffic grows."
                : "There is not enough data to make a recommendation yet."}
            </p>
          ) : (
            <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed">
              {overview.improvements.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <BarChart
            title="Top pages by views"
            data={overview.topPages.map((page) => ({
              label: page.path,
              value: page.pageviews,
            }))}
          />
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <BarChart
            title="Top traffic sources"
            data={overview.sources.map((source) => ({
              label: source.source === "direct" ? "Direct" : source.source,
              value: source.pageviews,
            }))}
          />
        </section>
      </div>

      <section
        aria-labelledby="funnel-heading"
        className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="space-y-1">
          <h2 id="funnel-heading" className="font-semibold tracking-tight">
            Conversion funnel
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Distinct visitors reaching each stage. An engaged visit is two or
            more page views. Stages count independently, so a visitor can start
            a form without clicking a tracked call to action.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Visitors</th>
                <th className="py-2 pr-4 font-medium">From previous</th>
                <th className="py-2 pr-4 font-medium">From first visit</th>
                <th className="py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {overview.funnel.map((stage) => (
                <tr
                  key={stage.key}
                  className="border-border/60 border-b last:border-0"
                >
                  <td className="py-3 pr-4">{stage.label}</td>
                  <td className="py-3 pr-4 font-semibold tabular-nums">
                    {stage.visitors.toLocaleString("en-US")}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {stage.fromPrevious === null
                      ? "—"
                      : `${stage.fromPrevious}%`}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {stage.fromVisit === null ? "—" : `${stage.fromVisit}%`}
                  </td>
                  <td className="w-40 py-3">
                    <span className="bg-muted/50 block h-2 overflow-hidden rounded-full">
                      <span
                        className="block h-full rounded-full bg-[var(--chart-1)]"
                        style={{
                          width: `${
                            visitCount > 0
                              ? Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (stage.visitors / visitCount) * 100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="campaigns-heading"
          className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 id="campaigns-heading" className="font-semibold tracking-tight">
            UTM campaigns
          </h2>
          {overview.campaigns.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              No campaign visits were recorded. Add utm_source, utm_medium, and
              utm_campaign to links in outbound campaigns to measure them here.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Medium</th>
                    <th className="py-2 pr-4 font-medium">Campaign</th>
                    <th className="py-2 pr-4 font-medium">Visitors</th>
                    <th className="py-2 font-medium">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.campaigns.map((campaign) => (
                    <tr
                      key={`${campaign.source ?? ""}|${campaign.medium ?? ""}|${campaign.campaign ?? ""}`}
                      className="border-border/60 border-b last:border-0"
                    >
                      <td className="py-2 pr-4">{campaign.source ?? "—"}</td>
                      <td className="text-muted-foreground py-2 pr-4">
                        {campaign.medium ?? "—"}
                      </td>
                      <td className="py-2 pr-4">{campaign.campaign ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        {campaign.visitors.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 tabular-nums">
                        {campaign.pageviews.toLocaleString("en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          aria-labelledby="events-heading"
          className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 id="events-heading" className="font-semibold tracking-tight">
            Tracked events
          </h2>
          {overview.events.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              No custom events were recorded. Clicks on elements with a
              data-track attribute and tracked form events appear here.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[24rem] text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-4 font-medium">Event</th>
                    <th className="py-2 pr-4 font-medium">Count</th>
                    <th className="py-2 font-medium">Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.events.map((event) => (
                    <tr
                      key={event.name}
                      className="border-border/60 border-b last:border-0"
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {event.name}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {event.count.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 tabular-nums">
                        {event.visitors.toLocaleString("en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section
        aria-labelledby="vitals-heading"
        className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="space-y-1">
          <h2 id="vitals-heading" className="font-semibold tracking-tight">
            Web Vitals
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Field data from real visits, shown at the 75th percentile.
            Thresholds are the published Web Vitals boundaries.
          </p>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {overview.vitals.map((vital) => (
            <div
              key={vital.metric}
              className="border-border rounded-xl border p-4"
            >
              <dt className="text-muted-foreground text-xs">
                {vital.metric} · {metricName(vital.metric)}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {vital.p75 === null
                  ? "—"
                  : formatVital(vital.metric, vital.p75)}
              </dd>
              <dd className="mt-1 text-xs">
                {vital.rating === null ? (
                  <span className="text-muted-foreground">No field data</span>
                ) : (
                  <>
                    <span className={RATING_CLASS[vital.rating]}>
                      {RATING_LABEL[vital.rating]}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {vital.samples.toLocaleString("en-US")} samples
                    </span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {overview.vitalsByPath.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-4 font-medium">Page</th>
                  <th className="py-2 pr-4 font-medium">Views</th>
                  {(["LCP", "INP", "CLS", "FCP", "TTFB"] as const).map(
                    (metric) => (
                      <th key={metric} className="py-2 pr-4 font-medium">
                        {metric}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {overview.vitalsByPath.map((page) => (
                  <tr
                    key={page.path}
                    className="border-border/60 border-b last:border-0"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{page.path}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {page.pageviews.toLocaleString("en-US")}
                    </td>
                    {(["LCP", "INP", "CLS", "FCP", "TTFB"] as const).map(
                      (metric) => (
                        <td key={metric} className="py-2 pr-4">
                          <VitalCell
                            metric={metric}
                            data={page.metrics[metric]}
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted-foreground mt-3 text-xs">
              Hover a value to see its sample count. Pages with fewer than five
              samples are shown but are not used for recommendations.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
