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
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

const DEFAULT_MAX_ATTEMPTS = 5;
/** Statuses a job never leaves on its own. */
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;
/**
 * How long a claim is held. Long enough for the slowest handler (a website
 * audit allows 8s per request plus redirects) with a wide margin, short enough
 * that a crashed worker's job is retried promptly.
 */
export const LOCK_DURATION_MS = 5 * 60 * 1000;

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
 * a job orphaned by a crashed worker gets retried.
 */
export async function claimNextJob(
  workerId: string,
  now = new Date(),
): Promise<JobDoc | null> {
  const collection = await jobs();

  const claimed = await collection.findOneAndUpdate(
    {
      $or: [
        { status: "queued", runAt: { $lte: now } },
        { status: "running", lockedUntil: { $lte: now } },
      ],
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
): Promise<void> {
  const collection = await jobs();
  await collection.updateOne(
    { _id: new ObjectId(jobId) },
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

  if (isExhausted(job.attempts, job.maxAttempts)) {
    await collection.updateOne(
      { _id: job._id },
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
    { _id: job._id },
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
