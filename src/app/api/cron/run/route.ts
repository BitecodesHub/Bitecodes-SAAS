import type { NextRequest } from "next/server";
import { after } from "next/server";
import { getCronSecret } from "@/lib/server/env";
import { safeCompare } from "@/lib/server/crypto";
import { runDueJobs } from "@/lib/server/jobs/worker";
import { getQueueStats } from "@/lib/server/jobs/queue";
import { enqueueDueAutomations } from "@/lib/server/jobs/schedule";
import { recordHeartbeat } from "@/lib/server/jobs/heartbeat";
import { runBootstrap } from "@/lib/server/bootstrap";

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
/*
  Five minutes, like the desktop assistant: AI automations take 20 to 60
  seconds per call, and a 60-second function killed them mid-call with their
  lock still held.
*/
export const maxDuration = 300;

/** Mirrors `maxDuration`, which must stay a literal for the build. */
const MAX_DURATION_MS = 300_000;
/** Leaves headroom for the response and the queue stats. */
const RUN_BUDGET_MS = 270_000;
/** A follow-up pass inside `after()`, which shares `maxDuration`. */
const KICK_BUDGET_MS = 20_000;
/** Time kept back for the response itself and for `after()` to start. */
const KICK_MARGIN_MS = 10_000;

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
  const startedAt = Date.now();

  // Reconcile first boot before scheduling work. The full pass runs once a
  // day; every other heartbeat repairs only an entirely empty preset list and
  // re-checks that the schedule still has handlers. A bootstrap failure is
  // reported and logged, never allowed to stop the drain — a broken settings
  // write must not also stop email that is already queued.
  let bootstrap: {
    ok: boolean;
    reconciled: boolean;
    settingsCreated: boolean;
    presetsCreated: number;
    presetsTotal: number;
    scheduleOk: boolean;
    outboundGate: string;
    errors: string[];
  } | null = null;
  try {
    const report = await runBootstrap({ source: "heartbeat" });
    bootstrap = {
      ok: report.ok,
      reconciled: report.reconciled,
      settingsCreated: report.settings.created,
      presetsCreated: report.presets.created,
      presetsTotal: report.presets.total,
      scheduleOk: report.schedules.ok,
      outboundGate: report.gates.state,
      errors: report.errors,
    };
    if (!report.ok) {
      console.error(
        "[cron] Bootstrap reconciliation reported errors:",
        report.errors.join(" | "),
      );
    }
  } catch (error) {
    console.error(
      "[cron] Bootstrap reconciliation threw:",
      error instanceof Error ? error.message : error,
    );
  }

  // Enqueue every recurring automation that is due (see `schedule.ts`) before
  // draining the queue, so a single cron cadence drives everything. Each key
  // is bucketed to its cadence, so repeated cron calls — or two instances
  // firing at once — cannot pile up duplicates. Enqueue failures are logged
  // per item and never stop the drain.
  try {
    await enqueueDueAutomations(new Date());
  } catch (error) {
    console.error(
      "[cron] Could not enqueue recurring work:",
      error instanceof Error ? error.message : error,
    );
  }

  let summary: Awaited<ReturnType<typeof runDueJobs>>;
  try {
    summary = await runDueJobs({ budgetMs: RUN_BUDGET_MS });
  } catch (error) {
    // A thrown drain is the one cron failure worth persisting explicitly: the
    // next successful tick must not erase the fact that automation stalled.
    await recordHeartbeat({
      source: "cron",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  await recordHeartbeat({ source: "cron", ok: true });

  // If the budget ran out with work still queued, start another pass after the
  // response so a backlog drains without waiting for the next cron tick — but
  // only when that pass still fits inside `maxDuration`, which `after()`
  // shares with the request.
  const remainingMs = MAX_DURATION_MS - (Date.now() - startedAt);
  const kickBudgetMs = Math.min(KICK_BUDGET_MS, remainingMs - KICK_MARGIN_MS);
  if (summary.budgetExhausted && kickBudgetMs >= 10_000) {
    after(async () => {
      const { kickJobs } = await import("@/lib/server/jobs/worker");
      await kickJobs(kickBudgetMs);
    });
  }

  return Response.json(
    { ok: true, ...summary, bootstrap, queue: await getQueueStats() },
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
