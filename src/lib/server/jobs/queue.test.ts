import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * The idempotency key has two jobs that pull in opposite directions: it must
 * make a send unrepeatable, and it must not make an operator's "do it again"
 * button a silent no-op. These tests pin both halves, because getting the
 * second one wrong is invisible — the UI reports success either way.
 */
describeWithDatabase("job queue idempotency", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { jobs } = await import("@/lib/server/db/collections");
    await (await jobs()).deleteMany({});
  });

  it("returns the existing job when a key is enqueued twice while queued", async () => {
    const { enqueueJob, JOB_TYPES } = await import("@/lib/server/jobs/queue");

    const first = await enqueueJob({
      type: JOB_TYPES.prospectEnrich,
      payload: { prospectId: "a".repeat(24) },
      idempotencyKey: "enrich:same",
    });
    const second = await enqueueJob({
      type: JOB_TYPES.prospectEnrich,
      payload: { prospectId: "a".repeat(24) },
      idempotencyKey: "enrich:same",
    });

    expect(second).toBe(first);

    const { jobs } = await import("@/lib/server/db/collections");
    expect(
      await (await jobs()).countDocuments({ idempotencyKey: "enrich:same" }),
    ).toBe(1);
  });

  it("refuses a second job once the key's job has finished, by default", async () => {
    const { enqueueJob, completeJob, JOB_TYPES } =
      await import("@/lib/server/jobs/queue");

    const first = await enqueueJob({
      type: JOB_TYPES.emailSend,
      payload: { messageId: "msg-1" },
      idempotencyKey: "email:msg-1",
    });
    await completeJob(first, { sent: true });

    // A send must never be repeatable: this is the guard that stops a retried
    // approval from delivering the same message twice.
    const again = await enqueueJob({
      type: JOB_TYPES.emailSend,
      payload: { messageId: "msg-1" },
      idempotencyKey: "email:msg-1",
    });

    expect(again).toBe(first);

    const { jobs } = await import("@/lib/server/db/collections");
    const all = await (await jobs())
      .find({ type: JOB_TYPES.emailSend })
      .toArray();
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe("completed");
  });

  it("queues fresh work with requeueIfFinished once the previous job finished", async () => {
    const { enqueueJob, completeJob, JOB_TYPES } =
      await import("@/lib/server/jobs/queue");

    const first = await enqueueJob({
      type: JOB_TYPES.prospectEnrich,
      payload: { prospectId: "b".repeat(24) },
      idempotencyKey: "enrich:redo",
    });
    await completeJob(first, { score: 78 });

    const second = await enqueueJob({
      type: JOB_TYPES.prospectEnrich,
      payload: { prospectId: "b".repeat(24) },
      idempotencyKey: "enrich:redo",
      requeueIfFinished: true,
    });

    expect(second).not.toBe(first);

    const { jobs } = await import("@/lib/server/db/collections");
    const collection = await jobs();
    // The finished job keeps its history but releases the key, so the unique
    // index has room for the new one.
    expect(
      await collection.countDocuments({ type: JOB_TYPES.prospectEnrich }),
    ).toBe(2);
    expect(
      await collection.countDocuments({ idempotencyKey: "enrich:redo" }),
    ).toBe(1);
    const fresh = await collection.findOne({ idempotencyKey: "enrich:redo" });
    expect(fresh?.status).toBe("queued");
  });

  it("still deduplicates requeueIfFinished against a job that has not finished", async () => {
    const { enqueueJob, JOB_TYPES } = await import("@/lib/server/jobs/queue");

    const first = await enqueueJob({
      type: JOB_TYPES.prospectEnrich,
      payload: { prospectId: "c".repeat(24) },
      idempotencyKey: "enrich:pending",
      requeueIfFinished: true,
    });
    // An impatient second click must not double the work.
    const second = await enqueueJob({
      type: JOB_TYPES.prospectEnrich,
      payload: { prospectId: "c".repeat(24) },
      idempotencyKey: "enrich:pending",
      requeueIfFinished: true,
    });

    expect(second).toBe(first);

    const { jobs } = await import("@/lib/server/db/collections");
    expect(
      await (await jobs()).countDocuments({ type: JOB_TYPES.prospectEnrich }),
    ).toBe(1);
  });
});
