import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { rollupAnalyticsDay } from "@/lib/server/analytics/repository";
import { getSettingsFresh } from "@/lib/server/settings";

/**
 * `analytics.rollup` — Aggregates yesterday's first-party events into
 * `analytics_daily`.
 *
 * Runs at 01:00 UTC. The roll-up is an upsert keyed on (date, path), so a
 * retry, a manual "Run now", and a late re-run after late beacons all produce
 * the same rows rather than double counts.
 *
 * An optional `date` payload allows an operator to backfill one completed UTC
 * day. Today and future dates are refused, because a partial day would look
 * like a traffic collapse in the digest.
 */

function yesterdayUtc(now = new Date()): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  return date.toISOString().slice(0, 10);
}

function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function handleAnalyticsRollup(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.analyticsRollup) {
    context.log("Analytics roll-up is switched off.");
    return { skipped: "disabled" };
  }

  if (Date.now() > context.deadline - 5_000) {
    context.log("Not enough time left in this run to start the roll-up.");
    return { skipped: "deadline" };
  }

  let date = yesterdayUtc();
  if (payload.date !== undefined) {
    const requested =
      typeof payload.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
        ? payload.date
        : null;
    const parsed = requested ? new Date(`${requested}T00:00:00.000Z`) : null;
    if (
      !requested ||
      !parsed ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== requested
    ) {
      context.log("Ignored an invalid roll-up date.");
      return { skipped: "invalid-date" };
    }
    if (requested >= todayUtc()) {
      context.log("Refused to roll up a day that is not complete.");
      return { skipped: "invalid-date" };
    }
    date = requested;
  }

  const result = await rollupAnalyticsDay(date);
  context.log(
    `Rolled up ${date}: ${result.pageviews} page views, ${result.visitors} visitors, ${result.paths} path${result.paths === 1 ? "" : "s"}.`,
  );
  return { ...result };
}
