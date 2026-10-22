import "server-only";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { jobs } from "@/lib/server/db/collections";
import type { JobDoc } from "@/lib/server/db/types";

/**
 * A durable job queue on MongoDB.
 *
 * Automation in this app — prospect enrichment, outreach sends, scheduled
 * publishing, search-engine pings — must survive a process restart and must
 * not run twice. Both properties come from a single atomic
 * `findOneAndUpdate`: a worker claims a job by flipping its status and taking
 * a time-bounded lock in one operation, so two workers can never claim the
 * same job.
 *
 * A crashed worker leaves a job `running` with an expired `lockedUntil`; the
 * next claim reclaims it rather than leaving it stuck forever.
 */

export const JOB_TYPES = {
  /** Discover businesses in a map area and upsert them as prospects. */
  prospectDiscover: "prospect.discover",
  /** Audit and classify one prospect. */
  prospectEnrich: "prospect.enrich",
  /** Render and queue one outreach or transactional email. */
  emailSend: "email.send",
  /** Advance every active sequence enrolment that is due. */
  sequenceTick: "sequence.tick",
  /** Run due autopilot presets and auto-enrol qualified prospects. */
  autopilotTick: "autopilot.tick",
  /** Publish scheduled blog posts whose time has arrived. */
  blogPublishScheduled: "blog.publish-scheduled",
  /** Draft, and (per settings) auto-publish, one AI blog post. */
  blogGenerate: "blog.generate",
  /** Notify search engines that a URL changed. */
  searchPing: "search.ping",
  /** Send the owner a daily summary. */
  dailyDigest: "digest.daily",
  /** Poll IMAP for replies, when IMAP is configured. */
  replyPoll: "reply.poll",

  // Growth engine. Cadences live in `schedule.ts`; handlers in `handlers.ts`.
  /** Aggregate yesterday's first-party analytics into daily rows. */
  analyticsRollup: "analytics.rollup",
  /** Summarise yesterday's website chats; extract leads and open questions. */
  chatSummaries: "chat.summaries",
  /** Score every customer for churn risk; optional win-back email. */
  churnScan: "churn.scan",
  /** Score and qualify new or changed leads against the ICP. */
  leadScore: "lead.score",
  /** Write an AI research brief for newly enriched prospects. */
  prospectResearch: "prospect.research",
  /** Draft personalised outreach for qualified prospects (approval queue). */
  outreachDraft: "outreach.draft",
  /** Customer onboarding, renewal, and cross-sell touches. */
  lifecycleTick: "lifecycle.tick",
  /** Remind the owner about stalled proposals; expire stale ones. */
  proposalFollowups: "proposal.followups",
  /** Email reminders before booked calls. */
  bookingReminders: "booking.reminders",
  /** The owner's weekly growth report. */
  reportWeekly: "report.weekly",
  /** Draft social posts from recent articles. */
  socialDrafts: "social.drafts",
  /** Send satisfaction surveys to eligible customers. */
  feedbackRequests: "feedback.requests",
  /** Draft the weekly newsletter for approval. */
  newsletterDraft: "newsletter.draft",
  /** Audit this website's key pages and report regressions. */
  seoSelfAudit: "seo.selfaudit",
  /** Monthly usage reports for customers. */
  reportMonthly: "report.monthly",
  /** Finish referral rewards that qualified but were never journalled. */
  referralReconcile: "referral.reconcile",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/**
 * The least run budget a job type needs before a worker may claim it.
 *
 * Short opportunistic runs (`kickJobs` after a form submission, the cron
 * route's follow-up pass) have 10 to 30 seconds. An AI-heavy job claimed by
 * such a run would either fail with "not enough time" (spending one of its
 * attempts) or finish with almost nothing done and spend its daily
 * idempotency key. Types listed here are simply left in the queue for a run
 * with enough budget, which the five-minute cron always provides. Types not
 * listed can be claimed by any run.
 */
export const JOB_MIN_BUDGET_MS: Partial<Record<JobType, number>> = {
  // A long article: up to three minutes of drafting plus saving and pinging.
  [JOB_TYPES.blogGenerate]: 90_000,
  // AI calls take 20 to 60 seconds each.
  [JOB_TYPES.chatSummaries]: 60_000,
  [JOB_TYPES.leadScore]: 60_000,
  [JOB_TYPES.prospectResearch]: 60_000,
  [JOB_TYPES.outreachDraft]: 60_000,
  [JOB_TYPES.reportWeekly]: 60_000,
  [JOB_TYPES.socialDrafts]: 60_000,
  [JOB_TYPES.newsletterDraft]: 60_000,
  [JOB_TYPES.reportMonthly]: 60_000,
  // Audits several live pages at up to eight seconds per request.
  [JOB_TYPES.seoSelfAudit]: 60_000,
};

/** Job types a run with `remainingMs` left must not claim. Pure. */
export function jobTypesTooHeavyFor(remainingMs: number): JobType[] {
  return (Object.entries(JOB_MIN_BUDGET_MS) as [JobType, number][])
    .filter(([, minimum]) => remainingMs < minimum)
    .map(([type]) => type);
}

/**
 * Thrown by a handler that cannot do its work in this run (too little time
 * left, a dependency not ready yet) but has not failed. The worker puts the
 * job back in the queue without counting the attempt, so deferring never
 * dead-letters a job.
 */
export class JobDeferredError extends Error {
  constructor(
    message: string,
    /** How long to wait before the job may be claimed again. */
    readonly retryAfterMs = 5 * 60 * 1000,
  ) {
    super(message);
    this.name = "JobDeferredError";
  }
}

const DEFAULT_MAX_ATTEMPTS = 5;
/** Statuses a job never leaves on its own. */
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;
/**
 * How long a claim is held.
 *
 * Deliberately longer than the cron route's 300s `maxDuration`: a lock that
 * expires while its worker is still alive lets a second tick claim and start
 * the same job, which for an outbound email is a duplicate send. A crashed
 * worker's job is retried after this window, so the cost of the margin is a
 * ten-minute delay on recovery, not lost work.
 */
export const LOCK_DURATION_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Exponential backoff with full jitter, capped at one hour.
 *
 * Jitter matters because failures are usually correlated: if a hundred
 * enrichment jobs fail because a provider is down, retrying them all at the
 * same instant reproduces the outage. `random` is injectable so tests can
 * assert bounds deterministically.
 */
export function nextRetryDelayMs(attempts: number, random = Math.random) {
  const base = Math.min(
    30_000 * 2 ** Math.max(0, attempts - 1),
    60 * 60 * 1000,
  );
  // Full jitter over [base/2, base] — still backs off, but spreads the herd.
  return Math.round(base / 2 + random() * (base / 2));
}

/** True when a failed job has exhausted its attempts and should dead-letter. */
export function isExhausted(attempts: number, maxAttempts: number) {
  return attempts >= maxAttempts;
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export interface EnqueueOptions {
  type: JobType;
  payload?: Record<string, unknown>;
  /** Earliest run time. Defaults to now. */
  runAt?: Date;
  maxAttempts?: number;
  /**
   * Deduplication key. A second enqueue with the same key while the first is
   * still pending is a no-op, which makes callers safe to retry.
   *
   * Note that the key also matches jobs that have already finished, so by
   * default a key is spent for good once its job completes. That is deliberate
   * for work that must never happen twice — an outbound email above all — and
   * wrong for work an operator can legitimately ask for again, which is what
   * `requeueIfFinished` is for.
   */
  idempotencyKey?: string;
  /**
   * Allows a fresh job when the key's previous job has already finished.
   *
   * Only for operator-triggered work that is safe to repeat, such as
   * re-auditing a prospect's website. Deduplication against a job that is
   * still queued or running is preserved either way, so double-clicking a
   * button cannot queue the same work twice. Never set this for sends.
   */
  requeueIfFinished?: boolean;
}

export async function enqueueJob({
  type,
  payload = {},
  runAt = new Date(),
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  idempotencyKey,
  requeueIfFinished = false,
}: EnqueueOptions): Promise<string> {
  const collection = await jobs();
  const now = new Date();
  const document: Omit<JobDoc, "_id"> = {
    type,
    payload,
    status: "queued",
    runAt,
    attempts: 0,
    maxAttempts,
    lockedUntil: null,
    lockedBy: null,
    lastError: null,
    result: null,
    idempotencyKey: idempotencyKey ?? null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
  };

  if (!idempotencyKey) {
    const inserted = await collection.insertOne(document as JobDoc);
    return inserted.insertedId.toHexString();
  }

  if (requeueIfFinished) {
    // Release the key from a job that has already finished, so the unique
    // index cannot block the fresh one. Scoped to terminal states on purpose:
    // a job that is still queued or running keeps its key, which is what makes
    // a double-click a no-op rather than duplicate work.
    await collection.updateOne(
      { idempotencyKey, status: { $in: TERMINAL_STATUSES } },
      { $set: { idempotencyKey: null, updatedAt: now } },
    );
  }

  // Upsert on the key so a duplicate enqueue returns the existing job.
  try {
    const result = await collection.findOneAndUpdate(
      { idempotencyKey },
      { $setOnInsert: document },
      { upsert: true, returnDocument: "after" },
    );
    return result?._id?.toHexString() ?? "";
  } catch (error) {
    // A concurrent upsert can still lose the unique-index race; the winner's
    // job is the one we want, so look it up rather than failing the caller.
    if (isDuplicateKeyError(error)) {
      const existing = await collection.findOne({ idempotencyKey });
      if (existing?._id) return existing._id.toHexString();
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

// ---------------------------------------------------------------------------
// Claim and complete
// ---------------------------------------------------------------------------

/**
 * Atomically claims the next due job, or returns null when none is due.
 *
 * The filter also matches `running` jobs whose lock has expired, which is how
 * a job orphaned by a crashed worker gets retried. `excludeTypes` leaves the
 * named types in the queue (see `jobTypesTooHeavyFor`).
 */
export async function claimNextJob(
  workerId: string,
  now = new Date(),
  {
    excludeTypes = [],
    includeTypes = [],
  }: {
    excludeTypes?: readonly string[];
    includeTypes?: readonly string[];
  } = {},
): Promise<JobDoc | null> {
  const collection = await jobs();

  const claimed = await collection.findOneAndUpdate(
    {
      $or: [
        { status: "queued", runAt: { $lte: now } },
        { status: "running", lockedUntil: { $lte: now } },
      ],
      // One `type` key: two would silently replace each other in the query.
      ...(includeTypes.length > 0 || excludeTypes.length > 0
        ? {
            type: {
              ...(includeTypes.length > 0 ? { $in: [...includeTypes] } : {}),
              ...(excludeTypes.length > 0 ? { $nin: [...excludeTypes] } : {}),
            },
          }
        : {}),
    },
    {
      $set: {
        status: "running",
        lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
        lockedBy: workerId,
        startedAt: now,
        updatedAt: now,
      },
      $inc: { attempts: 1 },
    },
    // Oldest first, so a burst of new work cannot starve an earlier job.
    { sort: { runAt: 1 }, returnDocument: "after" },
  );

  return claimed ?? null;
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown> | null = null,
  now = new Date(),
  /**
   * When provided, the write only applies while this worker still owns the
   * lock. A worker that overran its lock (or was paused across a deployment)
   * must not mark a job complete after another worker has reclaimed it.
   */
  workerId?: string,
): Promise<void> {
  const collection = await jobs();
  await collection.updateOne(
    {
      _id: new ObjectId(jobId),
      ...(workerId ? { lockedBy: workerId } : {}),
    },
    {
      $set: {
        status: "completed",
        result,
        lockedUntil: null,
        lockedBy: null,
        lastError: null,
        finishedAt: now,
        updatedAt: now,
      },
    },
  );
}

/**
 * Records a failure: reschedules with backoff, or dead-letters once the
 * attempt budget is spent. A dead-lettered job stays in the collection with
 * status `failed` so it is visible in the admin panel and can be retried by
 * hand — silently dropping failed work is how automation loses data.
 */
export async function failJob(
  job: JobDoc,
  error: unknown,
  now = new Date(),
  random = Math.random,
): Promise<{ requeued: boolean; runAt: Date | null }> {
  const collection = await jobs();
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  // Bound the stored message so a huge provider error cannot bloat the record.
  const lastError = message.slice(0, 1_000);
  // Only the worker that holds the lock may write the outcome. See completeJob.
  const owner = job.lockedBy ? { lockedBy: job.lockedBy } : {};

  if (isExhausted(job.attempts, job.maxAttempts)) {
    await collection.updateOne(
      { _id: job._id, ...owner },
      {
        $set: {
          status: "failed",
          lastError,
          lockedUntil: null,
          lockedBy: null,
          finishedAt: now,
          updatedAt: now,
        },
      },
    );
    return { requeued: false, runAt: null };
  }

  const runAt = new Date(
    now.getTime() + nextRetryDelayMs(job.attempts, random),
  );
  await collection.updateOne(
    { _id: job._id, ...owner },
    {
      $set: {
        status: "queued",
        lastError,
        runAt,
        lockedUntil: null,
        lockedBy: null,
        updatedAt: now,
      },
    },
  );
  return { requeued: true, runAt };
}

/**
 * Puts a claimed job back in the queue without spending an attempt: the
 * claim's increment is undone. Used for `JobDeferredError`, which means "not
 * now", not "failed".
 */
export async function deferJob(
  job: JobDoc,
  reason: string,
  retryAfterMs: number,
  now = new Date(),
): Promise<Date> {
  const collection = await jobs();
  const runAt = new Date(now.getTime() + Math.max(0, retryAfterMs));
  await collection.updateOne(
    {
      _id: job._id,
      ...(job.lockedBy ? { lockedBy: job.lockedBy } : {}),
    },
    {
      $set: {
        status: "queued",
        runAt,
        lockedUntil: null,
        lockedBy: null,
        result: { deferred: reason.slice(0, 300) },
        updatedAt: now,
      },
      $inc: { attempts: -1 },
    },
  );
  return runAt;
}

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

/** Requeues a dead-lettered job, resetting its attempt count. */
export async function retryJob(jobId: string, now = new Date()) {
  const collection = await jobs();
  const result = await collection.updateOne(
    { _id: new ObjectId(jobId), status: { $in: ["failed", "cancelled"] } },
    {
      $set: {
        status: "queued",
        attempts: 0,
        runAt: now,
        lastError: null,
        lockedUntil: null,
        lockedBy: null,
        finishedAt: null,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount === 1;
}

export async function cancelJob(jobId: string, now = new Date()) {
  const collection = await jobs();
  const result = await collection.updateOne(
    { _id: new ObjectId(jobId), status: { $in: ["queued", "running"] } },
    {
      $set: {
        status: "cancelled",
        lockedUntil: null,
        lockedBy: null,
        finishedAt: now,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount === 1;
}

/** Counts by status, for the admin queue-health panel. */
export async function getQueueStats(): Promise<Record<string, number>> {
  const collection = await jobs();
  const rows = await collection
    .aggregate<{
      _id: string;
      count: number;
    }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();

  const stats: Record<string, number> = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const row of rows) stats[row._id] = row.count;
  return stats;
}

export function newWorkerId() {
  return `worker-${randomUUID().slice(0, 8)}`;
}
