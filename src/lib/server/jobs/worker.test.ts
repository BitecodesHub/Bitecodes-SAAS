import { beforeEach, describe, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describe("job minimum budgets", () => {
  it("lists the types a run with too little time left must not claim", async () => {
    const { jobTypesTooHeavyFor, JOB_TYPES } =
      await import("@/lib/server/jobs/queue");
    const short = jobTypesTooHeavyFor(15_000);
    expect(short).toContain(JOB_TYPES.blogGenerate);
    expect(short).toContain(JOB_TYPES.leadScore);
    expect(short).toContain(JOB_TYPES.outreachDraft);
    expect(short).not.toContain(JOB_TYPES.searchPing);
    expect(jobTypesTooHeavyFor(60_000)).toEqual([JOB_TYPES.blogGenerate]);
    expect(jobTypesTooHeavyFor(270_000)).toEqual([]);
  });
});

/**
 * The run deadline handed to handlers: what lets an AI-heavy handler stop
 * starting new work before the platform kills the function mid-call.
 */
describeWithDatabase("job worker deadline", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { jobs } = await import("@/lib/server/db/collections");
    await (await jobs()).deleteMany({});
  });

  it("passes each handler the deadline of the run budget", async () => {
    const { enqueueJob, JOB_TYPES } = await import("@/lib/server/jobs/queue");
    const { runDueJobs } = await import("@/lib/server/jobs/worker");
    await enqueueJob({ type: JOB_TYPES.leadScore, idempotencyKey: "a" });
    await enqueueJob({ type: JOB_TYPES.churnScan, idempotencyKey: "b" });

    const seen: number[] = [];
    const start = Date.now();
    const summary = await runDueJobs({
      budgetMs: 120_000,
      now: () => start,
      handlers: {
        [JOB_TYPES.leadScore]: async (_payload, context) => {
          seen.push(context.deadline);
          return { ok: true };
        },
        [JOB_TYPES.churnScan]: async (_payload, context) => {
          seen.push(context.deadline);
        },
      },
    });

    expect(summary.completed).toBe(2);
    expect(seen).toEqual([start + 120_000, start + 120_000]);
  });

  it("records the handler log and summary on the job", async () => {
    const { enqueueJob, JOB_TYPES } = await import("@/lib/server/jobs/queue");
    const { runDueJobs } = await import("@/lib/server/jobs/worker");
    const { jobs } = await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");
    const id = await enqueueJob({ type: JOB_TYPES.seoSelfAudit });

    await runDueJobs({
      budgetMs: 120_000,
      handlers: {
        [JOB_TYPES.seoSelfAudit]: async (_payload, context) => {
          context.log("Not implemented yet.");
          return { skipped: "not-implemented" };
        },
      },
    });

    const job = await (await jobs()).findOne({ _id: new ObjectId(id) });
    expect(job?.status).toBe("completed");
    expect(job?.result).toEqual({
      skipped: "not-implemented",
      log: ["Not implemented yet."],
    });
  });

  it("leaves AI-heavy jobs queued for a run with enough budget", async () => {
    const { enqueueJob, JOB_TYPES } = await import("@/lib/server/jobs/queue");
    const { runDueJobs } = await import("@/lib/server/jobs/worker");
    const { jobs } = await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");
    const blogId = await enqueueJob({
      type: JOB_TYPES.blogGenerate,
      idempotencyKey: "blog",
    });
    await enqueueJob({ type: JOB_TYPES.searchPing, idempotencyKey: "ping" });

    const ran: string[] = [];
    const handlers = {
      [JOB_TYPES.blogGenerate]: async () => {
        ran.push("blog");
      },
      [JOB_TYPES.searchPing]: async () => {
        ran.push("ping");
      },
    };

    // A 15-second kick, as after a form submission: the light job runs, the
    // blog job is not claimed, so it keeps all of its attempts.
    const kick = await runDueJobs({ budgetMs: 15_000, handlers });
    expect(ran).toEqual(["ping"]);
    expect(kick.claimed).toBe(1);
    const waiting = await (await jobs()).findOne({ _id: new ObjectId(blogId) });
    expect(waiting).toMatchObject({ status: "queued", attempts: 0 });

    // The cron run has the budget, so it claims it.
    const cron = await runDueJobs({ budgetMs: 270_000, handlers });
    expect(ran).toEqual(["ping", "blog"]);
    expect(cron.completed).toBe(1);
  });

  it("requeues a deferred job without spending an attempt", async () => {
    const { enqueueJob, JOB_TYPES, JobDeferredError } =
      await import("@/lib/server/jobs/queue");
    const { runDueJobs } = await import("@/lib/server/jobs/worker");
    const { jobs } = await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");
    const id = await enqueueJob({ type: JOB_TYPES.analyticsRollup });
    const start = Date.now();

    const summary = await runDueJobs({
      budgetMs: 30_000,
      now: () => start,
      handlers: {
        [JOB_TYPES.analyticsRollup]: async () => {
          throw new JobDeferredError("Not enough time left.", 60_000);
        },
      },
    });

    expect(summary).toMatchObject({ claimed: 1, deferred: 1, failed: 0 });
    const job = await (await jobs()).findOne({ _id: new ObjectId(id) });
    expect(job).toMatchObject({
      status: "queued",
      attempts: 0,
      lockedBy: null,
      result: { deferred: "Not enough time left." },
    });
    expect(job?.runAt.getTime()).toBe(start + 60_000);
  });
});
