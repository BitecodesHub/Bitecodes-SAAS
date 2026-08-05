import "server-only";

import { getImapConfig } from "@/lib/server/env";
import { prospects, sequenceEnrollments } from "@/lib/server/db/collections";
import { stopEnrollment } from "@/lib/server/email/sequences";
import { addProspectNote } from "@/lib/server/prospecting/repository";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * Detects replies by polling the outreach mailbox over IMAP.
 *
 * Deliberately **stateless**: every poll searches the last few days of the
 * inbox and matches sender addresses against the pipeline, rather than
 * tracking UIDs. Everything downstream is idempotent — stopping a stopped
 * enrolment is a no-op and a prospect already marked `replied` stays put —
 * so re-seeing a message costs nothing, and there is no UID/uidValidity
 * bookkeeping to corrupt. At this pipeline's volume an envelope-only fetch
 * over a three-day window is a few kilobytes.
 *
 * A reply is the single most valuable signal the system receives; this is
 * what lets "status of every client" stay true without a human reading the
 * inbox first.
 */

const LOOKBACK_DAYS = 3;

export async function handleReplyPoll(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const config = getImapConfig();
  if (!config) {
    context.log("IMAP is not configured; reply detection is off.");
    return { skipped: "imap-not-configured" };
  }

  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  const senders = new Set<string>();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      for await (const message of client.fetch(
        (Array.isArray(uids) ? uids : []).slice(-500),
        { envelope: true },
        { uid: true },
      )) {
        for (const from of message.envelope?.from ?? []) {
          if (from.address) senders.add(from.address.trim().toLowerCase());
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  if (senders.size === 0) return { senders: 0, matched: 0 };

  // Match senders against active enrolments and contacted prospects.
  const enrollments = await sequenceEnrollments();
  const prospectCollection = await prospects();
  const senderList = [...senders];

  const activeEnrollments = await enrollments
    .find({ status: "active", email: { $in: senderList } })
    .toArray();

  let stopped = 0;
  for (const enrollment of activeEnrollments) {
    await stopEnrollment(enrollment.enrollmentId, "replied");
    stopped += 1;
  }

  const contacted = await prospectCollection
    .find({
      email: { $in: senderList },
      status: { $in: ["queued", "contacted"] },
    })
    .toArray();

  let advanced = 0;
  for (const prospect of contacted) {
    const id = prospect._id?.toHexString();
    if (!id) continue;
    await prospectCollection.updateOne(
      { _id: prospect._id },
      { $set: { status: "replied", updatedAt: new Date() } },
    );
    await addProspectNote(id, {
      authorId: null,
      authorName: "Autopilot",
      body: "They replied — detected in the outreach inbox. Sequence stopped; over to you.",
    });
    await recordAudit({
      action: AUDIT_ACTIONS.leadReplied,
      target: { type: "prospect", id },
      detail: { via: "imap" },
    });
    advanced += 1;
  }

  context.log(
    `${senders.size} sender(s) in window; ${stopped} sequence(s) stopped, ${advanced} prospect(s) marked replied.`,
  );
  return { senders: senders.size, stopped, advanced };
}
