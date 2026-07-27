import type { NextRequest } from "next/server";
import { after } from "next/server";
import { getCronSecret } from "@/lib/server/env";
import { safeCompare } from "@/lib/server/crypto";
import { runDueJobs } from "@/lib/server/jobs/worker";
import { enqueueJob, getQueueStats, JOB_TYPES } from "@/lib/server/jobs/queue";

/**
 * The job runner.
 *
 * Driven by an external scheduler (Vercel Cron, GitHub Actions, or any cron
 * that can make an authenticated request) rather than a long-lived worker
 * process, so the same code runs on serverless and on a container.
 *
 * `maxDuration` and the run budget are deliberately paired: the worker stops
 * claiming new jobs before the platform would kill the function, so a job is
 * never abandoned mid-flight with its lock still held.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Leaves headroom for the response and for `after()` work to start. */
const RUN_BUDGET_MS = 50_000;

function unauthorized() {
  return Response.json(
    { ok: false, error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Requires a bearer token matching `CRON_SECRET`.
 *
 * When no secret is configured the endpoint refuses to run rather than running
 * openly: an unauthenticated job runner lets anyone drain the queue, force
 * outbound email, and burn the OpenRouter budget.
 */
function authorize(
  request: NextRequest,
): "ok" | "unauthorized" | "unconfigured" {
  const secret = getCronSecret();
  if (!secret) return "unconfigured";

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return "unauthorized";

  return safeCompare(provided, secret) ? "ok" : "unauthorized";
}

/**
 * Queues the periodic jobs this endpoint is responsible for driving.
 *
 * Failures are swallowed: a cron run that cannot enqueue a tick should still
 * drain whatever is already queued rather than returning an error.
 */
async function enqueueRecurringWork(now = new Date()): Promise<void> {
  const minuteBucket = Math.floor(now.getTime() / 60_000);
  try {
    await enqueueJob({
      type: JOB_TYPES.sequenceTick,
      idempotencyKey: `sequence-tick:${minuteBucket}`,
    });
  } catch (error) {
    console.error(
      "[cron] Could not enqueue the sequence tick:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function handle(request: NextRequest) {
  const auth = authorize(request);

  if (auth === "unconfigured") {
    return Response.json(
      {
        ok: false,
        error:
          "CRON_SECRET is not configured. The job runner will not run unauthenticated.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (auth === "unauthorized") return unauthorized();

  // Enqueue the recurring maintenance work before draining the queue, so a
  // single cron cadence drives everything.
  //
  // Sequences are the reason this exists: their follow-ups are scheduled hours
  // or days ahead, and without a periodic tick nothing would ever advance them.
  // The idempotency key is bucketed to the minute so repeated cron calls — or
  // two instances firing at once — cannot pile up duplicate ticks.
  await enqueueRecurringWork();

  const summary = await runDueJobs({ budgetMs: RUN_BUDGET_MS });

  // If the budget ran out with work still queued, start another pass after the
  // response so a backlog drains without waiting for the next cron tick.
  if (summary.budgetExhausted) {
    after(async () => {
      const { kickJobs } = await import("@/lib/server/jobs/worker");
      await kickJobs(20_000);
    });
  }

  return Response.json(
    { ok: true, ...summary, queue: await getQueueStats() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Vercel Cron issues GET requests. */
export async function GET(request: NextRequest) {
  return handle(request);
}

/** POST for manual triggers and for schedulers that prefer it. */
export async function POST(request: NextRequest) {
  return handle(request);
}
