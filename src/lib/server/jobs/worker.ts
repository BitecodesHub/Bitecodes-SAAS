import "server-only";

import { ObjectId } from "mongodb";
import { jobs } from "@/lib/server/db/collections";
import type { JobDoc } from "@/lib/server/db/types";
import {
  claimNextJob,
  completeJob,
  failJob,
  newWorkerId,
  type JobType,
} from "@/lib/server/jobs/queue";
import { getJobHandlers } from "@/lib/server/jobs/handlers";

/**
 * The job worker.
 *
 * Runs inside an HTTP request (`/api/cron/run`) rather than as a separate
 * process, so the same code works on a serverless platform, a container, or a
 * laptop with no cron at all. It therefore works to a **time budget**: it
 * stops claiming new jobs once the budget is nearly spent so the response is
 * returned before the platform's function timeout kills it mid-job.
 */

export interface JobContext {
  jobId: string;
  attempts: number;
  /** Collected into the job's `result` so a run is inspectable afterwards. */
  log: (message: string) => void;
}

export type JobHandler = (
  payload: Record<string, unknown>,
  context: JobContext,
) => Promise<Record<string, unknown> | void>;

export type JobHandlerMap = Partial<Record<JobType, JobHandler>>;

export interface RunOptions {
  /** Wall-clock budget for the whole run. */
  budgetMs?: number;
  maxJobs?: number;
  /** Overridden in tests; defaults to the real registry. */
  handlers?: JobHandlerMap;
  workerId?: string;
  now?: () => number;
}

export interface RunSummary {
  claimed: number;
  completed: number;
  failed: number;
  /** Jobs whose type has no registered handler — a deployment mismatch. */
  unhandled: number;
  durationMs: number;
  /** True when the run stopped because it ran out of budget, not out of work. */
  budgetExhausted: boolean;
}

/**
 * Reserve enough of the budget to finish the current job and write its result.
 * Claiming a job with less than this left risks the lock outliving the process.
 */
const RESERVE_MS = 5_000;

export async function runDueJobs({
  budgetMs = 50_000,
  maxJobs = 25,
  handlers = getJobHandlers(),
  workerId = newWorkerId(),
  now = Date.now,
}: RunOptions = {}): Promise<RunSummary> {
  const startedAt = now();
  const summary: RunSummary = {
    claimed: 0,
    completed: 0,
    failed: 0,
    unhandled: 0,
    durationMs: 0,
    budgetExhausted: false,
  };

  while (summary.claimed < maxJobs) {
    if (now() - startedAt > budgetMs - RESERVE_MS) {
      summary.budgetExhausted = true;
      break;
    }

    const job = await claimNextJob(workerId, new Date(now()));
    if (!job) break;
    summary.claimed += 1;

    const jobId = job._id?.toHexString() ?? "";
    const handler = handlers[job.type as JobType];

    if (!handler) {
      // Retrying cannot help: either the type is misspelled or this deployment
      // is older than the code that enqueued it. Dead-letter it immediately so
      // it surfaces in the admin panel instead of burning retries.
      summary.unhandled += 1;
      summary.failed += 1;
      await deadLetter(jobId, `No handler registered for "${job.type}"`);
      continue;
    }

    const lines: string[] = [];
    try {
      const result = await handler(job.payload, {
        jobId,
        attempts: job.attempts,
        log: (message) => lines.push(message),
      });
      await completeJob(
        jobId,
        { ...(result ?? {}), ...(lines.length ? { log: lines } : {}) },
        new Date(now()),
      );
      summary.completed += 1;
    } catch (error) {
      await failJob(job, error, new Date(now()));
      summary.failed += 1;
    }
  }

  summary.durationMs = now() - startedAt;
  return summary;
}

async function deadLetter(jobId: string, message: string) {
  if (!jobId) return;
  const collection = await jobs();
  const now = new Date();
  await collection.updateOne(
    { _id: new ObjectId(jobId) },
    {
      $set: {
        status: "failed",
        lastError: message,
        lockedUntil: null,
        lockedBy: null,
        finishedAt: now,
        updatedAt: now,
      },
    },
  );
}

/**
 * Fire-and-forget nudge for local development and single-instance hosting.
 *
 * Call inside `after()` following an enqueue so work starts immediately
 * without waiting for the next cron tick. Errors are swallowed: this is an
 * optimisation, and the cron run remains the guaranteed path.
 */
export async function kickJobs(budgetMs = 10_000): Promise<void> {
  try {
    await runDueJobs({ budgetMs, maxJobs: 5 });
  } catch (error) {
    console.error(
      "[jobs] Opportunistic run failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export type { JobDoc };
