import "server-only";

import { randomUUID } from "node:crypto";
import {
  emailMessages,
  emailSequences,
  emailTemplates,
  sequenceEnrollments,
} from "@/lib/server/db/collections";
import { extractVariables } from "@/lib/email/template";
import {
  FOLLOWUP_TEMPLATE_SEEDS,
  SEQUENCE_SEEDS,
} from "@/lib/email/templates/followups";
import { blockText } from "@/lib/server/email/templates";
import { getTemplate, getTemplateForTag } from "@/lib/server/email/templates";
import { queueEmail } from "@/lib/server/email/send";
import { isSuppressed } from "@/lib/server/email/suppression";
import {
  buildOutreachVariables,
  buildReportUrl,
  buildUnsubscribeUrl,
} from "@/lib/server/email/outreach";
import {
  getProspect,
  recordProspectContacted,
} from "@/lib/server/prospecting/repository";
import { getSettingsFresh } from "@/lib/server/settings";
import type {
  EmailSequenceDoc,
  EmailTemplateDoc,
  SequenceEnrollmentDoc,
} from "@/lib/server/db/types";

/**
 * The follow-up sequence engine.
 *
 * Two properties carry the whole design, and both are about *not* sending:
 *
 * **1. A step is claimed atomically before it is sent.** Advancing `currentStep`
 * and clearing `nextRunAt` happen in the same `findOneAndUpdate` that matches the
 * enrolment as due. Two workers ticking concurrently therefore cannot both send
 * step two — the increment *is* the lock. Checking-then-updating would leave a
 * window in which a stranger receives the same email twice, which is the single
 * most damaging thing an outreach system can do.
 *
 * **2. Every stop condition is re-checked immediately before each send**, not
 * only at enrolment. Somebody who unsubscribed after step one must never receive
 * step two, and by then the enrolment is already scheduled.
 *
 * Known limitation, stated rather than hidden: SMTP can send but cannot read a
 * mailbox, so "stop because they replied" cannot be fully automatic without IMAP.
 * The engine stops on a click, an unsubscribe, and any manual pipeline change
 * (replied, meeting, won, lost). An operator who gets a reply and does nothing in
 * the panel will still have a follow-up go out — so a click stops the sequence by
 * default, since a click is the most common precursor to a reply.
 */

export type StopReason =
  | "unsubscribed"
  | "clicked"
  | "prospect-advanced"
  | "sequence-disabled"
  | "no-template"
  | "send-refused"
  | "manual";

/** Pipeline stages that mean a human has taken over. */
const HUMAN_HAS_IT = new Set([
  "replied",
  "meeting",
  "won",
  "lost",
  "suppressed",
]);

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** Inserts the follow-up templates and the default sequence if absent. */
export async function ensureSeededSequences(
  now = new Date(),
): Promise<{ templates: number; sequences: number }> {
  const templateCollection = await emailTemplates();
  const sequenceCollection = await emailSequences();

  let templates = 0;
  for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
    const existing = await templateCollection.findOne({ key: seed.key });
    if (existing) continue;

    await templateCollection.insertOne({
      key: seed.key,
      name: seed.name,
      description: seed.description,
      subject: seed.subject,
      blocks: seed.blocks,
      variables: extractVariables(seed.subject, ...blockText(seed.blocks)),
      category: "outreach",
      // Follow-ups are not tag-specific; the first email carried the finding.
      prospectTag: null,
      enabled: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    } as EmailTemplateDoc);
    templates += 1;
  }

  let sequences = 0;
  for (const seed of SEQUENCE_SEEDS) {
    const existing = await sequenceCollection.findOne({ key: seed.key });
    if (existing) continue;

    await sequenceCollection.insertOne({
      key: seed.key,
      name: seed.name,
      description: seed.description,
      prospectTag: null,
      enabled: true,
      // `null` in a seed step means "the template for this prospect's tag".
      // Stored as an empty string because the document type requires a string;
      // resolved back at send time.
      steps: seed.steps.map((step) => ({
        templateKey: step.templateKey ?? "",
        delayHours: step.delayHours,
      })),
      stopOnClick: seed.stopOnClick,
      createdAt: now,
      updatedAt: now,
    } as EmailSequenceDoc);
    sequences += 1;
  }

  return { templates, sequences };
}

export async function getSequence(
  key: string,
): Promise<EmailSequenceDoc | null> {
  const collection = await emailSequences();
  return collection.findOne({ key });
}

export async function listSequences(): Promise<EmailSequenceDoc[]> {
  await ensureSeededSequences();
  const collection = await emailSequences();
  return collection.find({}).sort({ key: 1 }).toArray();
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

export type EnrollResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; reason: string; detail: string };

/**
 * Enrols one prospect and sends step one immediately.
 *
 * Refuses the same cases `prepareProspectOutreach` refuses, plus an existing
 * active enrolment — two concurrent sequences to the same person would
 * interleave follow-ups and read as a malfunction.
 */
export async function enrollProspect(
  prospectId: string,
  sequenceKey = "outreach.default",
  now = new Date(),
): Promise<EnrollResult> {
  await ensureSeededSequences(now);

  const sequence = await getSequence(sequenceKey);
  if (!sequence) {
    return { ok: false, reason: "no-sequence", detail: "Unknown sequence." };
  }
  if (!sequence.enabled) {
    return {
      ok: false,
      reason: "sequence-disabled",
      detail: "That sequence is switched off.",
    };
  }

  const prospect = await getProspect(prospectId);
  if (!prospect) {
    return { ok: false, reason: "missing", detail: "Prospect not found." };
  }
  if (!prospect.classification) {
    return {
      ok: false,
      reason: "not-classified",
      detail:
        "This customer has not been checked, so there is no verified reason to contact them.",
    };
  }
  if (!prospect.email) {
    return { ok: false, reason: "no-email", detail: "No email address." };
  }
  if (await isSuppressed(prospect.email)) {
    return {
      ok: false,
      reason: "unsubscribed",
      detail: "This address is on the never-contact list.",
    };
  }

  const enrollments = await sequenceEnrollments();
  const active = await enrollments.findOne({
    prospectId,
    status: "active",
  });
  if (active) {
    return {
      ok: false,
      reason: "already-enrolled",
      detail: "This customer is already part of a running sequence.",
    };
  }

  const enrollmentId = randomUUID();
  await enrollments.insertOne({
    enrollmentId,
    sequenceKey,
    prospectId,
    leadId: null,
    email: prospect.email,
    status: "active",
    stoppedReason: null,
    // Zero steps sent yet; the send below advances it to 1.
    currentStep: 0,
    nextRunAt: now,
    createdAt: now,
    updatedAt: now,
  } as SequenceEnrollmentDoc);

  // Step one goes out through the same path as every later step, so there is
  // one implementation of "send a sequence step" rather than two that can drift.
  const advanced = await advanceEnrollment(enrollmentId, now);
  if (!advanced.sent) {
    return {
      ok: false,
      reason: advanced.stoppedReason ?? "send-refused",
      detail: advanced.detail ?? "The first email was not queued.",
    };
  }

  return { ok: true, enrollmentId };
}

// ---------------------------------------------------------------------------
// Advancing
// ---------------------------------------------------------------------------

export interface AdvanceOutcome {
  sent: boolean;
  completed: boolean;
  stoppedReason: StopReason | null;
  detail: string | null;
  step: number | null;
}

/**
 * Claims the next due step for one enrolment and sends it.
 *
 * The claim is the `findOneAndUpdate` below: it matches only an active,
 * currently-due enrolment and increments `currentStep` while clearing
 * `nextRunAt` in one operation. A second worker running the same instant either
 * gets null (already claimed) or nothing due. This is what makes a duplicate
 * send impossible rather than merely unlikely.
 */
export async function advanceEnrollment(
  enrollmentId: string,
  now = new Date(),
): Promise<AdvanceOutcome> {
  const enrollments = await sequenceEnrollments();

  const claimed = await enrollments.findOneAndUpdate(
    { enrollmentId, status: "active", nextRunAt: { $lte: now } },
    { $inc: { currentStep: 1 }, $set: { nextRunAt: null, updatedAt: now } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    return {
      sent: false,
      completed: false,
      stoppedReason: null,
      detail: "Not due, or already claimed.",
      step: null,
    };
  }

  // `currentStep` is now the 1-based number of the step being sent.
  const stepNumber = claimed.currentStep;
  const stepIndex = stepNumber - 1;

  const sequence = await getSequence(claimed.sequenceKey);
  if (!sequence || !sequence.enabled) {
    await stopEnrollment(enrollmentId, "sequence-disabled", now);
    return outcome(
      false,
      false,
      "sequence-disabled",
      "Sequence unavailable.",
      stepNumber,
    );
  }

  if (stepIndex >= sequence.steps.length) {
    await completeEnrollment(enrollmentId, now);
    return outcome(false, true, null, "Sequence finished.", stepNumber);
  }

  // ---- Stop conditions, re-checked immediately before sending ----

  if (await isSuppressed(claimed.email)) {
    await stopEnrollment(enrollmentId, "unsubscribed", now);
    return outcome(
      false,
      false,
      "unsubscribed",
      "Recipient opted out.",
      stepNumber,
    );
  }

  const prospect = claimed.prospectId
    ? await getProspect(claimed.prospectId)
    : null;

  if (claimed.prospectId && !prospect) {
    await stopEnrollment(enrollmentId, "manual", now);
    return outcome(false, false, "manual", "Prospect deleted.", stepNumber);
  }

  if (prospect && HUMAN_HAS_IT.has(prospect.status)) {
    await stopEnrollment(enrollmentId, "prospect-advanced", now);
    return outcome(
      false,
      false,
      "prospect-advanced",
      `A person is handling this one (${prospect.status}).`,
      stepNumber,
    );
  }

  if (sequence.stopOnClick && (await hasClicked(enrollmentId))) {
    await stopEnrollment(enrollmentId, "clicked", now);
    return outcome(
      false,
      false,
      "clicked",
      "They clicked, so a person should take it from here.",
      stepNumber,
    );
  }

  // ---- Resolve the template for this step ----

  const step = sequence.steps[stepIndex]!;
  const template = step.templateKey
    ? await getTemplate(step.templateKey)
    : prospect?.classification
      ? await getTemplateForTag(prospect.classification.primaryTag)
      : null;

  if (!template || !template.enabled) {
    await stopEnrollment(enrollmentId, "no-template", now);
    return outcome(
      false,
      false,
      "no-template",
      "No enabled template for this step.",
      stepNumber,
    );
  }

  // ---- Send ----

  const settings = await getSettingsFresh();
  const variables = prospect
    ? buildOutreachVariables(prospect, {
        reportUrl: buildReportUrl(claimed.prospectId!),
        unsubscribeUrl: buildUnsubscribeUrl(claimed.email, claimed.prospectId!),
        senderName: settings.outreach.senderName,
        companyName: "Bitecodes",
      })
    : {};

  const result = await queueEmail({
    to: claimed.email,
    toName: prospect?.name ?? null,
    subject: template.subject,
    blocks: template.blocks,
    variables,
    category: "outreach",
    templateKey: template.key,
    prospectId: claimed.prospectId,
    enrollmentId,
    sequenceStep: stepNumber,
    countryCode: prospect?.countryCode ?? null,
    unsubscribeUrl: String(variables.unsubscribeUrl ?? ""),
    footerNote:
      "You are receiving this because your business is publicly listed and we found something worth flagging. One click above removes you permanently.",
    track: true,
  });

  if (result.status === "skipped") {
    // A cap or a region guard is not the recipient's decision, so the enrolment
    // is stopped rather than retried — silently deferring would leave it in a
    // state nobody is watching.
    await stopEnrollment(enrollmentId, "send-refused", now);
    return outcome(
      false,
      false,
      "send-refused",
      result.detail ?? result.skipReason ?? "Refused.",
      stepNumber,
    );
  }

  if (claimed.prospectId) await recordProspectContacted(claimed.prospectId);

  // Schedule the next step, or finish.
  const nextStep = sequence.steps[stepIndex + 1];
  if (!nextStep) {
    await completeEnrollment(enrollmentId, now);
    return outcome(true, true, null, "Final step sent.", stepNumber);
  }

  await enrollments.updateOne(
    { enrollmentId },
    {
      $set: {
        nextRunAt: new Date(now.getTime() + nextStep.delayHours * 3_600_000),
        updatedAt: now,
      },
    },
  );

  return outcome(true, false, null, null, stepNumber);
}

function outcome(
  sent: boolean,
  completed: boolean,
  stoppedReason: StopReason | null,
  detail: string | null,
  step: number | null,
): AdvanceOutcome {
  return { sent, completed, stoppedReason, detail, step };
}

/** True when any message sent for this enrolment has recorded a click. */
async function hasClicked(enrollmentId: string): Promise<boolean> {
  const collection = await emailMessages();
  const clicked = await collection.countDocuments({
    enrollmentId,
    clicks: { $ne: [] },
  });
  return clicked > 0;
}

export async function stopEnrollment(
  enrollmentId: string,
  reason: StopReason,
  now = new Date(),
): Promise<boolean> {
  const enrollments = await sequenceEnrollments();
  const result = await enrollments.updateOne(
    { enrollmentId, status: "active" },
    {
      $set: {
        status: "stopped",
        stoppedReason: reason,
        nextRunAt: null,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount === 1;
}

async function completeEnrollment(
  enrollmentId: string,
  now = new Date(),
): Promise<void> {
  const enrollments = await sequenceEnrollments();
  await enrollments.updateOne(
    { enrollmentId },
    {
      $set: {
        status: "completed",
        nextRunAt: null,
        updatedAt: now,
      },
    },
  );
}

/**
 * Stops every active enrolment for one email address.
 *
 * Called when somebody unsubscribes, so a person with two enrolments does not
 * keep receiving one of them.
 */
export async function stopEnrollmentsForEmail(
  email: string,
  reason: StopReason = "unsubscribed",
  now = new Date(),
): Promise<number> {
  const enrollments = await sequenceEnrollments();
  const result = await enrollments.updateMany(
    { email: email.trim().toLowerCase(), status: "active" },
    {
      $set: {
        status: "stopped",
        stoppedReason: reason,
        nextRunAt: null,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount;
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

export interface TickSummary {
  due: number;
  sent: number;
  completed: number;
  stopped: number;
  stoppedReasons: Record<string, number>;
}

/**
 * Advances every enrolment that is due.
 *
 * Sequential rather than parallel: each step reads the daily cap, and running
 * them concurrently would let a batch overshoot it before any one of them
 * observed the others.
 */
export async function tickSequences(
  now = new Date(),
  limit = 200,
): Promise<TickSummary> {
  // Seed here too, not only on enrolment. A fresh deployment driven by cron but
  // never visited in the admin panel would otherwise have no sequence to run,
  // which is exactly the case where nobody is watching.
  await ensureSeededSequences(now);

  const enrollments = await sequenceEnrollments();

  const due = await enrollments
    .find({ status: "active", nextRunAt: { $lte: now } })
    .sort({ nextRunAt: 1 })
    .limit(Math.min(1_000, Math.max(1, limit)))
    .toArray();

  const summary: TickSummary = {
    due: due.length,
    sent: 0,
    completed: 0,
    stopped: 0,
    stoppedReasons: {},
  };

  for (const enrollment of due) {
    const result = await advanceEnrollment(enrollment.enrollmentId, now);
    if (result.sent) summary.sent += 1;
    if (result.completed) summary.completed += 1;
    if (result.stoppedReason) {
      summary.stopped += 1;
      summary.stoppedReasons[result.stoppedReason] =
        (summary.stoppedReasons[result.stoppedReason] ?? 0) + 1;
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Reads for the admin panel
// ---------------------------------------------------------------------------

export async function getEnrollmentStats(): Promise<{
  active: number;
  completed: number;
  stopped: number;
  byStopReason: Record<string, number>;
}> {
  const enrollments = await sequenceEnrollments();
  const rows = await enrollments
    .aggregate<{
      _id: { status: string; reason: string | null };
      count: number;
    }>([
      {
        $group: {
          _id: { status: "$status", reason: "$stoppedReason" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const result = {
    active: 0,
    completed: 0,
    stopped: 0,
    byStopReason: {} as Record<string, number>,
  };

  for (const row of rows) {
    if (row._id.status === "active") result.active += row.count;
    if (row._id.status === "completed") result.completed += row.count;
    if (row._id.status === "stopped") {
      result.stopped += row.count;
      const reason = row._id.reason ?? "unknown";
      result.byStopReason[reason] =
        (result.byStopReason[reason] ?? 0) + row.count;
    }
  }

  return result;
}
