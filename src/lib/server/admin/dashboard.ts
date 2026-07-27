import "server-only";

import {
  auditReports,
  consultantRequests,
  contactEnquiries,
  emailMessages,
  prospects,
} from "@/lib/server/db/collections";
import { getQueueStats } from "@/lib/server/jobs/queue";
import { listAuditEntries } from "@/lib/server/audit-log";

/**
 * Dashboard aggregation.
 *
 * Every figure is computed with a count or a small aggregation rather than by
 * loading documents into memory, so the dashboard stays fast as the collections
 * grow.
 *
 * Every query is individually fault-tolerant: a dashboard is the first place
 * someone looks when something is wrong, so one failing collection must not
 * blank the whole page. A failed metric reads as `null` and renders as "—".
 */

export interface MetricPair {
  /** Current period. */
  current: number;
  /** The equivalent preceding period, for the delta. */
  previous: number;
}

export interface DashboardData {
  leads: MetricPair;
  prospectCount: number;
  emailsSent: MetricPair;
  auditRuns: MetricPair;
  consultantRuns: MetricPair;
  /** Daily counts for the trailing window, oldest first. */
  leadTrend: { labels: string[]; values: number[] };
  queue: Record<string, number>;
  recentActivity: Awaited<ReturnType<typeof listAuditEntries>>;
  /** Set when a query failed, so the UI can say so rather than show a zero. */
  degraded: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs a query, returning a fallback and recording the failure instead of
 * throwing. Keeps one broken collection from taking the whole dashboard down.
 */
async function safely<T>(
  label: string,
  degraded: string[],
  fallback: T,
  query: () => Promise<T>,
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    degraded.push(label);
    console.error(
      `[dashboard] ${label} failed:`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export async function getDashboardData(
  windowDays = 30,
  now = new Date(),
): Promise<DashboardData> {
  const degraded: string[] = [];
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);
  const previousStart = new Date(now.getTime() - 2 * windowDays * DAY_MS);

  const [
    leads,
    prospectCount,
    emailsSent,
    auditRuns,
    consultantRuns,
    leadTrend,
    queue,
    recentActivity,
  ] = await Promise.all([
    safely("leads", degraded, { current: 0, previous: 0 }, async () => {
      const collection = await contactEnquiries();
      const [current, previous] = await Promise.all([
        collection.countDocuments({ createdAt: { $gte: windowStart } }),
        collection.countDocuments({
          createdAt: { $gte: previousStart, $lt: windowStart },
        }),
      ]);
      return { current, previous };
    }),

    safely("prospects", degraded, 0, async () => {
      const collection = await prospects();
      return collection.countDocuments();
    }),

    safely("emails", degraded, { current: 0, previous: 0 }, async () => {
      const collection = await emailMessages();
      const [current, previous] = await Promise.all([
        collection.countDocuments({
          status: "sent",
          sentAt: { $gte: windowStart },
        }),
        collection.countDocuments({
          status: "sent",
          sentAt: { $gte: previousStart, $lt: windowStart },
        }),
      ]);
      return { current, previous };
    }),

    safely("audits", degraded, { current: 0, previous: 0 }, async () => {
      const collection = await auditReports();
      const [current, previous] = await Promise.all([
        collection.countDocuments({ createdAt: { $gte: windowStart } }),
        collection.countDocuments({
          createdAt: { $gte: previousStart, $lt: windowStart },
        }),
      ]);
      return { current, previous };
    }),

    safely("consultant", degraded, { current: 0, previous: 0 }, async () => {
      const collection = await consultantRequests();
      const [current, previous] = await Promise.all([
        collection.countDocuments({ createdAt: { $gte: windowStart } }),
        collection.countDocuments({
          createdAt: { $gte: previousStart, $lt: windowStart },
        }),
      ]);
      return { current, previous };
    }),

    safely("lead trend", degraded, { labels: [], values: [] }, async () => {
      const collection = await contactEnquiries();
      const rows = await collection
        .aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: { $gte: windowStart } } },
          {
            $group: {
              // Grouped in UTC so the buckets do not shift with the server's
              // timezone or across a daylight-saving boundary.
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                  timezone: "UTC",
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      return buildDailySeries(rows, windowStart, now);
    }),

    safely("queue", degraded, {}, () => getQueueStats()),
    safely("activity", degraded, [], () => listAuditEntries(8)),
  ]);

  return {
    leads,
    prospectCount,
    emailsSent,
    auditRuns,
    consultantRuns,
    leadTrend,
    queue,
    recentActivity,
    degraded,
  };
}

/**
 * Expands sparse aggregation rows into one entry per day.
 *
 * MongoDB only returns days that have data, so a chart built straight from the
 * rows would silently compress gaps and misrepresent the shape of the trend —
 * three leads on three scattered days would look like three consecutive days.
 */
export function buildDailySeries(
  rows: { _id: string; count: number }[],
  from: Date,
  to: Date,
): { labels: string[]; values: number[] } {
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  const labels: string[] = [];
  const values: number[] = [];

  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

  while (cursor.getTime() <= end) {
    const key = cursor.toISOString().slice(0, 10);
    labels.push(key.slice(5));
    values.push(counts.get(key) ?? 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { labels, values };
}
