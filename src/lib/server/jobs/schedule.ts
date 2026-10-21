import "server-only";

import type { GrowthToggleKey } from "@/lib/growth/toggles";
import { enqueueJob, JOB_TYPES, type JobType } from "@/lib/server/jobs/queue";

/**
 * Every recurring automation, declared once.
 *
 * The cron route (`/api/cron/run`, driven every five minutes by the GitHub
 * Actions heartbeat) asks `dueAutomations(now)` which entries are due and
 * enqueues each one under an idempotency key bucketed to its cadence, so the
 * same automation can never be queued twice for the same minute, quarter
 * hour, day, or month however often cron fires.
 *
 * All times are UTC (IST is UTC + 5:30). A `toggle` names the
 * `settings.growth` switch the handler checks; the scheduler itself does not
 * read settings, which keeps `dueAutomations` pure and lets a disabled job
 * record a visible "skipped: disabled" run instead of vanishing.
 */

export type AutomationCadence =
  | { kind: "minute" }
  | { kind: "quarter-hour" }
  | { kind: "daily"; hourUtc: number }
  | { kind: "weekly"; weekdaysUtc: readonly number[]; hourUtc: number }
  | { kind: "monthly"; dayOfMonth: number; hourUtc: number };

export interface RecurringAutomation {
  /** Idempotency-key prefix. Never rename one that has shipped. */
  id: string;
  type: JobType;
  label: string;
  description: string;
  cadence: AutomationCadence;
  /** The `settings.growth` switch its handler checks, or null if always on. */
  toggle: GrowthToggleKey | null;
  /** True when a run can email someone other than the owner. */
  sendsExternalEmail: boolean;
  /** The package that owns the handler. */
  owner: string;
}

export const RECURRING_AUTOMATIONS: RecurringAutomation[] = [
  // Existing automations (keys unchanged, so nothing re-runs on deploy).
  {
    id: "sequence-tick",
    type: JOB_TYPES.sequenceTick,
    label: "Email sequences",
    description:
      "Advances every active email sequence enrolment that is due. Commercial mail still passes the compliance gate and the approval queue.",
    cadence: { kind: "minute" },
    toggle: null,
    sendsExternalEmail: true,
    owner: "leads-crm",
  },
  {
    id: "autopilot-tick",
    type: JOB_TYPES.autopilotTick,
    label: "Prospecting autopilot",
    description:
      "Runs due discovery presets and enrols qualified prospects when the autopilot is switched on in settings.",
    cadence: { kind: "quarter-hour" },
    toggle: null,
    sendsExternalEmail: true,
    owner: "prospect-ai",
  },
  {
    id: "reply-poll",
    type: JOB_TYPES.replyPoll,
    label: "Reply detection",
    description:
      "Checks the outreach mailbox for replies so sequences stop automatically. Does nothing until IMAP is configured.",
    cadence: { kind: "quarter-hour" },
    toggle: null,
    sendsExternalEmail: false,
    owner: "core",
  },
  {
    id: "blog-publish",
    type: JOB_TYPES.blogPublishScheduled,
    label: "Scheduled blog publishing",
    description:
      "Publishes scheduled blog posts whose time has arrived and notifies search engines.",
    cadence: { kind: "quarter-hour" },
    toggle: null,
    sendsExternalEmail: false,
    owner: "content-engine",
  },

  // Growth engine.
  {
    id: "booking-reminders",
    type: JOB_TYPES.bookingReminders,
    label: "Booking reminders",
    description:
      "Emails a reminder 24 hours and 1 hour before each booked call.",
    cadence: { kind: "quarter-hour" },
    toggle: "bookingReminders",
    sendsExternalEmail: true,
    owner: "magnets",
  },
  {
    id: "analytics-rollup",
    type: JOB_TYPES.analyticsRollup,
    label: "Analytics roll-up",
    description:
      "Aggregates the page views, events, traffic sources, and web vitals of the previous day into daily rows.",
    cadence: { kind: "daily", hourUtc: 1 },
    toggle: "analyticsRollup",
    sendsExternalEmail: false,
    owner: "analytics",
  },
  {
    id: "chat-summaries",
    type: JOB_TYPES.chatSummaries,
    label: "Website chat review",
    description:
      "Summarises the website chats of the previous day, extracts leads, and lists unanswered questions.",
    cadence: { kind: "daily", hourUtc: 1 },
    toggle: "chatSummaries",
    sendsExternalEmail: false,
    owner: "assistant-calls",
  },
  {
    id: "churn-scan",
    type: JOB_TYPES.churnScan,
    label: "Churn scan",
    description:
      "Scores every customer account for churn risk. Sends a win-back email only when that separate switch is on.",
    cadence: { kind: "daily", hourUtc: 2 },
    toggle: "churnScan",
    sendsExternalEmail: true,
    owner: "loyalty",
  },
  {
    id: "lead-score",
    type: JOB_TYPES.leadScore,
    label: "Lead scoring",
    description:
      "Scores each new or changed lead against the ideal customer profile and adds a qualification note.",
    cadence: { kind: "daily", hourUtc: 2 },
    toggle: "leadScoring",
    sendsExternalEmail: false,
    owner: "leads-crm",
  },
  {
    id: "prospect-research",
    type: JOB_TYPES.prospectResearch,
    label: "Prospect research",
    description:
      "Writes a research brief for each newly enriched prospect from its audit and site facts.",
    cadence: { kind: "daily", hourUtc: 3 },
    toggle: "prospectResearch",
    sendsExternalEmail: false,
    owner: "prospect-ai",
  },
  {
    id: "outreach-draft",
    type: JOB_TYPES.outreachDraft,
    label: "Outreach drafts",
    description:
      "Drafts a personalised first email for each qualified prospect into the approval queue.",
    cadence: { kind: "daily", hourUtc: 3 },
    toggle: "outreachDrafts",
    sendsExternalEmail: false,
    owner: "prospect-ai",
  },
  {
    id: "daily-digest",
    type: JOB_TYPES.dailyDigest,
    label: "Owner daily digest",
    description:
      "Emails the owner a summary of leads, pipeline, analytics, approvals, and content awaiting review.",
    cadence: { kind: "daily", hourUtc: 4 },
    toggle: null,
    sendsExternalEmail: false,
    owner: "ops-reporting",
  },
  {
    id: "lifecycle-tick",
    type: JOB_TYPES.lifecycleTick,
    label: "Customer lifecycle",
    description:
      "Sends onboarding nudges, low-credit renewal reminders, and product suggestions to customers.",
    cadence: { kind: "daily", hourUtc: 5 },
    toggle: "lifecycleEmails",
    sendsExternalEmail: true,
    owner: "lifecycle",
  },
  {
    id: "search-ping",
    type: JOB_TYPES.searchPing,
    label: "Search engine ping",
    description:
      "Notifies search engines through IndexNow about pages that changed in the last day.",
    cadence: { kind: "daily", hourUtc: 6 },
    toggle: "searchPing",
    sendsExternalEmail: false,
    owner: "seo-tech",
  },
  {
    id: "proposal-followups",
    type: JOB_TYPES.proposalFollowups,
    label: "Proposal follow-ups",
    description:
      "Reminds the owner about proposals viewed but not accepted, and expires stale proposals.",
    cadence: { kind: "daily", hourUtc: 6 },
    toggle: "proposalFollowups",
    sendsExternalEmail: false,
    owner: "sales",
  },
  {
    id: "report-weekly",
    type: JOB_TYPES.reportWeekly,
    label: "Weekly growth report",
    description:
      "Emails the owner a written summary of the past week every Monday.",
    cadence: { kind: "weekly", weekdaysUtc: [1], hourUtc: 3 },
    toggle: "weeklyReport",
    sendsExternalEmail: false,
    owner: "ops-reporting",
  },
  {
    id: "social-drafts",
    type: JOB_TYPES.socialDrafts,
    label: "Social post drafts",
    description:
      "Drafts LinkedIn posts from recent articles every Monday. Nothing is posted automatically.",
    cadence: { kind: "weekly", weekdaysUtc: [1], hourUtc: 4 },
    toggle: "socialDrafts",
    sendsExternalEmail: false,
    owner: "content-engine",
  },
  {
    id: "blog-generate",
    type: JOB_TYPES.blogGenerate,
    label: "Blog drafts",
    description:
      "Drafts an article every Tuesday and Friday from a topic in the ideal customer profile.",
    cadence: { kind: "weekly", weekdaysUtc: [2, 5], hourUtc: 5 },
    toggle: "blogGenerate",
    sendsExternalEmail: false,
    owner: "content-engine",
  },
  {
    id: "feedback-requests",
    type: JOB_TYPES.feedbackRequests,
    label: "Feedback requests",
    description:
      "Sends a short satisfaction survey to eligible customers every Wednesday.",
    cadence: { kind: "weekly", weekdaysUtc: [3], hourUtc: 5 },
    toggle: "feedbackRequests",
    sendsExternalEmail: true,
    owner: "loyalty",
  },
  {
    id: "newsletter-draft",
    type: JOB_TYPES.newsletterDraft,
    label: "Newsletter draft",
    description:
      "Drafts the weekly newsletter every Thursday for approval. Nothing is sent automatically.",
    cadence: { kind: "weekly", weekdaysUtc: [4], hourUtc: 4 },
    toggle: "newsletterDrafts",
    sendsExternalEmail: false,
    owner: "content-engine",
  },
  {
    id: "seo-selfaudit",
    type: JOB_TYPES.seoSelfAudit,
    label: "SEO self-audit",
    description:
      "Audits the key pages of this website every Sunday and reports regressions.",
    cadence: { kind: "weekly", weekdaysUtc: [0], hourUtc: 2 },
    toggle: "seoSelfAudit",
    sendsExternalEmail: false,
    owner: "seo-tech",
  },
  {
    id: "report-monthly",
    type: JOB_TYPES.reportMonthly,
    label: "Monthly customer reports",
    description:
      "Emails each customer a summary of their usage and results for the previous month.",
    cadence: { kind: "monthly", dayOfMonth: 1, hourUtc: 4 },
    toggle: "monthlyCustomerReports",
    sendsExternalEmail: true,
    owner: "lifecycle",
  },
];

export interface DueAutomation {
  type: JobType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

const MINUTE_MS = 60_000;
const QUARTER_HOUR_MS = 15 * MINUTE_MS;

/** UTC date, YYYY-MM-DD. */
function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** UTC month, YYYY-MM. */
function utcMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** 1-based day of the UTC year (1 January is 1). */
export function utcDayOfYear(now: Date): number {
  return Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
}

function daysInUtcMonth(now: Date): number {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

/**
 * When an entry is due at `now`, its idempotency-key suffix and payload;
 * otherwise null.
 *
 * - minute: every call, keyed to the minute.
 * - quarter-hour: every call, keyed to the 15-minute bucket.
 * - daily: from `hourUtc` onwards, keyed to the UTC date.
 * - weekly: on a listed weekday from `hourUtc` onwards, keyed to the UTC date.
 * - monthly: from `hourUtc` on `dayOfMonth` (clamped to the month's last
 *   day), and at any hour on every later day of that month, keyed to the
 *   UTC month — so a run missed on the 1st still happens on the 2nd.
 */
function dueBucket(
  cadence: AutomationCadence,
  now: Date,
): { bucket: string; payload: Record<string, unknown> } | null {
  const hour = now.getUTCHours();
  switch (cadence.kind) {
    case "minute":
      return {
        bucket: String(Math.floor(now.getTime() / MINUTE_MS)),
        payload: {},
      };
    case "quarter-hour":
      return {
        bucket: String(Math.floor(now.getTime() / QUARTER_HOUR_MS)),
        payload: {},
      };
    case "daily": {
      if (hour < cadence.hourUtc) return null;
      const date = utcDate(now);
      return { bucket: date, payload: { date } };
    }
    case "weekly": {
      if (!cadence.weekdaysUtc.includes(now.getUTCDay())) return null;
      if (hour < cadence.hourUtc) return null;
      const date = utcDate(now);
      return { bucket: date, payload: { date } };
    }
    case "monthly": {
      const day = now.getUTCDate();
      const startDay = Math.min(
        Math.max(1, cadence.dayOfMonth),
        daysInUtcMonth(now),
      );
      if (day < startDay) return null;
      if (day === startDay && hour < cadence.hourUtc) return null;
      const period = utcMonth(now);
      return { bucket: period, payload: { period } };
    }
  }
}

/**
 * The automations due at `now`, ready to enqueue. Pure: no clock, no I/O, so
 * every boundary is unit-tested.
 */
export function dueAutomations(
  now: Date,
  registry: readonly RecurringAutomation[] = RECURRING_AUTOMATIONS,
): DueAutomation[] {
  const due: DueAutomation[] = [];
  for (const automation of registry) {
    const hit = dueBucket(automation.cadence, now);
    if (!hit) continue;
    due.push({
      type: automation.type,
      idempotencyKey: `${automation.id}:${hit.bucket}`,
      // The blog generator rotates topics by day of year; its payload shape
      // predates this registry and is kept exactly.
      payload:
        automation.type === JOB_TYPES.blogGenerate
          ? { dayOfYear: utcDayOfYear(now) }
          : hit.payload,
    });
  }
  return due;
}

/**
 * Enqueues everything due at `now`. One failure never stops the rest: a cron
 * run that cannot queue one automation should still queue the others and
 * drain what is already waiting.
 */
export async function enqueueDueAutomations(
  now = new Date(),
  enqueue: typeof enqueueJob = enqueueJob,
): Promise<{ enqueued: number; failed: string[] }> {
  const failed: string[] = [];
  let enqueued = 0;
  for (const item of dueAutomations(now)) {
    try {
      await enqueue({
        type: item.type,
        payload: item.payload,
        idempotencyKey: item.idempotencyKey,
      });
      enqueued += 1;
    } catch (error) {
      failed.push(item.type);
      console.error(
        `[cron] Could not enqueue ${item.type}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return { enqueued, failed };
}
