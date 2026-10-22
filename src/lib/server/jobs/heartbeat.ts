import "server-only";

import { systemState } from "@/lib/server/db/collections";

/**
 * Scheduler liveness.
 *
 * `/api/cron/run` is the only thing that advances automation. It is driven by
 * an external scheduler, so "no job failed" is not evidence of health — it may
 * simply mean no job ran. This module records every authenticated tick so the
 * health endpoint can answer the question that actually matters: when did
 * automation last make progress?
 */

export const HEARTBEAT_ID = "cron";

/** Warn after six missed five-minute ticks. GitHub can delay a run, not this long. */
export const HEARTBEAT_WARN_MS = 30 * 60 * 1000;

/** Fail once a scheduler has been silent long enough that a day's work is lost. */
export const HEARTBEAT_DEAD_MS = 6 * 60 * 60 * 1000;

export interface HeartbeatSnapshot {
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  lastTickOk: boolean | null;
  ticks: number;
  ageMs: number | null;
}

export interface RecordHeartbeatInput {
  source: string;
  ok: boolean;
  /** Stored for operators; never returned by the public health endpoint. */
  error?: string | null;
  now?: Date;
}

/**
 * Upserts the tick. Never throws: a bookkeeping failure must not turn a
 * completed queue drain into a failed request.
 */
export async function recordHeartbeat(
  input: RecordHeartbeatInput,
): Promise<void> {
  const now = input.now ?? new Date();
  try {
    const collection = await systemState();
    const set: Record<string, unknown> = {
      lastTickAt: now,
      lastTickSource: input.source.slice(0, 80),
      lastTickOk: input.ok,
      lastTickError: input.ok
        ? null
        : (input.error ?? "Unknown error").slice(0, 500),
      updatedAt: now,
    };
    if (input.ok) set.lastSuccessAt = now;

    await collection.updateOne(
      { _id: HEARTBEAT_ID },
      {
        $set: set,
        $inc: { ticks: 1 },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error(
      "[heartbeat] Could not record the scheduler tick:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function readHeartbeat(
  now = new Date(),
): Promise<HeartbeatSnapshot | null> {
  try {
    const collection = await systemState();
    const doc = await collection.findOne({ _id: HEARTBEAT_ID });
    if (!doc) return null;
    return {
      lastTickAt: doc.lastTickAt.toISOString(),
      lastSuccessAt: doc.lastSuccessAt?.toISOString() ?? null,
      lastTickOk: doc.lastTickOk,
      ticks: doc.ticks,
      ageMs: now.getTime() - doc.lastTickAt.getTime(),
    };
  } catch (error) {
    console.error(
      "[heartbeat] Could not read the scheduler tick:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
