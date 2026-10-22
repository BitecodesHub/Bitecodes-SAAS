import "server-only";

import { randomUUID } from "node:crypto";
import {
  bookings,
  emailMessages,
  emailSequences,
  emailTemplates,
  sequenceEnrollments,
} from "@/lib/server/db/collections";
import { extractVariables } from "@/lib/email/template";
import {
  ALL_FOLLOWUP_TEMPLATE_SEEDS,
  SEQUENCE_SEEDS,
} from "@/lib/email/templates/followups";
import { getIcpSegment } from "@/data/icp";
import { services } from "@/data/services";
import {
  getLead,
  isWritableLeadKind,
  legacyStatusToStage,
  recordLeadActivity,
  recordLeadContacted,
  type LeadDetail,
  type LeadKind,
} from "@/lib/server/leads/repository";
import { getSiteUrl } from "@/lib/server/env";
import { blockText } from "@/lib/server/email/templates";
import { getTemplate, getTemplateForTag } from "@/lib/server/email/templates";
import { queueEmail, type QueueEmailResult } from "@/lib/server/email/send";
import { isSuppressed } from "@/lib/server/email/suppression";
import {
  buildOutreachVariables,
  buildReportUrl,
  buildUnsubscribeUrl,
} from "@/lib/server/email/outreach";
import {
  claimProspectFirstContact,
  getProspect,
  recordProspectContacted,
  releaseProspectFirstContact,
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
  | "replied"
  | "prospect-advanced"
  | "lead-advanced"
  | "consent-withdrawn"
  | "consent-missing"
  | "booked"
  | "sequence-disabled"
  | "no-template"
  | "send-refused"
  | "already-contacted"
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
  for (const seed of ALL_FOLLOWUP_TEMPLATE_SEEDS) {
    const existing = await templateCollection.findOne({ key: seed.key });
    if (existing) continue;

    await templateCollection.insertOne({
      key: seed.key,
      name: seed.name,
      description: seed.description,
      subject: seed.subject,
      blocks: seed.blocks,
      variables: extractVariables(seed.subject, ...blockText(seed.blocks)),
      category: seed.category ?? "outreach",
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
      audience: seed.audience ?? "prospect",
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

/**
 * Per-process guard for the read path, matching `listTemplates`.
 *
 * `ensureSeededSequences` walks its seeds with one `findOne` each, sequentially,
 * and `listSequences` is called on every render of `/admin/email` — so that page
 * paid the whole walk again on every view. Seeding reconciles against code, which
 * cannot change within a running process, so once per instance is sufficient.
 *
 * The guard lives here and not inside `ensureSeededSequences` because direct
 * callers must still get real reconciliation: the tests assert insert counts
 * after mutating rows, and a deploy step needs the genuine article.
 */
let sequencesSeededThisProcess = false;

/** Test seam — forget the in-process flag. */
export function resetSeededSequencesFlag() {
  sequencesSeededThisProcess = false;
}

export async function listSequences(): Promise<EmailSequenceDoc[]> {
  if (!sequencesSeededThisProcess) {
    await ensureSeededSequences();
    sequencesSeededThisProcess = true;
  }
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

  // Step one is a first contact, so a sequence must never be the second one.
  // The atomic re-check happens at send time; this is the fast, explanatory
  // refusal for the common case.
  if (prospect.contactCount > 0) {
    return {
      ok: false,
      reason: "already-contacted",
      detail:
        "This customer has already received a first-contact email. Follow up manually instead of starting a new sequence.",
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

export interface EnrollLeadInput {
  leadKind: LeadKind;
  leadId: string;
  email: string;
  name?: string | null;
  sequenceKey?: string;
  /** The time marketing consent was given. Required for a lead sequence. */
  consentAt?: Date | null;
}

/**
 * Enrols an opted-in lead in the inbound follow-up sequence.
 *
 * Separate from `enrollProspect` because the consent model is different. A cold
 * prospect is lawful only in opt-out jurisdictions; a lead who ticked the
 * marketing box gave express consent, so the send path may pass the region gate.
 * Requiring `consentAt` here makes that claim explicit and auditable rather than
 * something one caller can silently get wrong.
 */
export async function enrollLead(
  input: EnrollLeadInput,
  now = new Date(),
): Promise<EnrollResult> {
  const sequenceKey = input.sequenceKey ?? "inbound.followup";
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
  if (sequence.audience !== "lead") {
    return {
      ok: false,
      reason: "wrong-audience",
      detail: "That sequence is for cold prospects, not inbound leads.",
    };
  }
  if (!isWritableLeadKind(input.leadKind)) {
    return {
      ok: false,
      reason: "read-only",
      detail: "Form and booking leads are read-only.",
    };
  }

  const lead = await getLead(input.leadKind, input.leadId);
  if (!lead) {
    return { ok: false, reason: "missing", detail: "Lead not found." };
  }
  if (lead.kind === "form" || lead.kind === "booking") {
    return {
      ok: false,
      reason: "read-only",
      detail: "Form and booking leads are read-only.",
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: "no-email", detail: "No email address." };
  }
  if (await isSuppressed(email)) {
    return {
      ok: false,
      reason: "unsubscribed",
      detail: "This address is on the never-contact list.",
    };
  }

  const stage = lead.doc.stage ?? legacyStatusToStage(lead.doc.status ?? "new");
  if (stage === "won" || stage === "lost" || stage === "proposal") {
    return {
      ok: false,
      reason: "closed",
      detail: "This lead is already closed or has a proposal.",
    };
  }

  const consent = "consent" in lead.doc ? lead.doc.consent : null;
  const consentAt = input.consentAt ?? consent?.at ?? null;
  if (!consentAt || consent?.marketing !== true) {
    return {
      ok: false,
      reason: "no-consent",
      detail: "The person did not opt in to follow-up email.",
    };
  }

  const enrollments = await sequenceEnrollments();
  const active = await enrollments.findOne({
    status: "active",
    $or: [{ leadId: input.leadId }, { email }],
  });
  if (active) {
    return {
      ok: false,
      reason: "already-enrolled",
      detail: "This lead is already part of a running sequence.",
    };
  }

  const enrollmentId = randomUUID();
  await enrollments.insertOne({
    enrollmentId,
    sequenceKey,
    prospectId: null,
    leadId: input.leadId,
    leadKind: input.leadKind,
    consentAt,
    email,
    status: "active",
    stoppedReason: null,
    currentStep: 0,
    nextRunAt: now,
    createdAt: now,
    updatedAt: now,
  } as SequenceEnrollmentDoc);

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

  const lead =
    claimed.leadId && claimed.leadKind
      ? await getLead(claimed.leadKind as LeadKind, claimed.leadId)
      : null;

  if (claimed.leadId && !lead) {
    await stopEnrollment(enrollmentId, "manual", now);
    return outcome(false, false, "manual", "Lead deleted.", stepNumber);
  }

  if (lead) {
    const stage = "stage" in lead.doc ? (lead.doc.stage ?? "new") : "new";

    if (
      stage === "qualified" ||
      stage === "proposal" ||
      stage === "won" ||
      stage === "lost"
    ) {
      await stopEnrollment(enrollmentId, "lead-advanced", now);
      return outcome(
        false,
        false,
        "lead-advanced",
        `A person is handling this lead (${stage}).`,
        stepNumber,
      );
    }

    // Re-check consent at every step. An opt-in recorded at capture is not a
    // permanent licence: a later unsubscribe or a different contact record must
    // stop the next message, not merely remove the link from it.
    const consent = "consent" in lead.doc ? lead.doc.consent : null;
    if (!claimed.consentAt) {
      await stopEnrollment(enrollmentId, "consent-missing", now);
      return outcome(
        false,
        false,
        "consent-missing",
        "No recorded marketing consent.",
        stepNumber,
      );
    }
    // Require a live opt-in, not merely the absence of a "no". A contact
    // record whose consent was cleared is not permission to keep sending.
    if (!consent || consent.marketing !== true) {
      await stopEnrollment(enrollmentId, "consent-withdrawn", now);
      return outcome(
        false,
        false,
        "consent-withdrawn",
        "The person withdrew marketing consent.",
        stepNumber,
      );
    }

    if (await hasConfirmedBooking(claimed.email)) {
      await stopEnrollment(enrollmentId, "booked", now);
      return outcome(
        false,
        false,
        "booked",
        "They already booked a call, so automation should stop.",
        stepNumber,
      );
    }
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
  const isLeadSequence = Boolean(lead);
  const variables = prospect
    ? buildOutreachVariables(prospect, {
        reportUrl: buildReportUrl(claimed.prospectId!),
        unsubscribeUrl: buildUnsubscribeUrl(claimed.email, claimed.prospectId!),
        senderName: settings.outreach.senderName,
        companyName: "Bitecodes",
      })
    : lead
      ? buildLeadVariables(lead, claimed.email, {
          senderName: settings.outreach.senderName,
          companyName: "Bitecodes",
        })
      : {};

  // Step one of a prospect sequence is that prospect's first contact. Claim
  // it atomically here, immediately before the render and enqueue, so an
  // operator "Send email" batch racing the autopilot cannot produce two first
  // contacts. Later steps are follow-ups and are counted after queueing.
  const claimsFirstContact = stepNumber === 1 && claimed.prospectId !== null;
  if (claimsFirstContact) {
    const claimedFirst = await claimProspectFirstContact(claimed.prospectId!);
    if (!claimedFirst) {
      await stopEnrollment(enrollmentId, "already-contacted", now);
      return outcome(
        false,
        false,
        "already-contacted",
        "Another first-contact email was already queued for this customer.",
        stepNumber,
      );
    }
  }

  let result: QueueEmailResult;
  try {
    result = await queueEmail({
      to: claimed.email,
      toName: prospect?.name ?? leadName(lead) ?? null,
      subject: template.subject,
      blocks: template.blocks,
      variables,
      category: isLeadSequence ? "nurture" : "outreach",
      templateKey: template.key,
      prospectId: claimed.prospectId,
      leadId: claimed.leadId,
      enrollmentId,
      sequenceStep: stepNumber,
      countryCode:
        prospect?.countryCode ??
        (lead && "country" in lead.doc ? lead.doc.country : null) ??
        null,
      unsubscribeUrl: String(variables.unsubscribeUrl ?? ""),
      // Only a lead sequence carries express consent. Cold outreach never does.
      consented: isLeadSequence && Boolean(claimed.consentAt),
      footerNote: isLeadSequence
        ? "You are receiving this because you opted in when you contacted us. One click above removes you permanently."
        : "You are receiving this because your business is publicly listed and we found something worth flagging. One click above removes you permanently.",
      track: true,
    });
  } catch (error) {
    // The queue may or may not have persisted the message before throwing, so
    // retrying could duplicate it. Stop the enrolment explicitly instead of
    // leaving it stranded with no next run. The first-contact claim is kept:
    // a throw cannot prove nothing was written, and a duplicate first contact
    // is worse than an operator having to re-check one prospect by hand.
    await stopEnrollment(enrollmentId, "send-refused", now);
    throw error;
  }

  if (result.status === "skipped") {
    // A cap or a region guard is not the recipient's decision, so the enrolment
    // is stopped rather than retried — silently deferring would leave it in a
    // state nobody is watching. Nothing was queued, so a first-contact claim is
    // returned rather than burning the prospect's only slot.
    if (claimsFirstContact) {
      await releaseProspectFirstContact(claimed.prospectId!).catch(
        () => undefined,
      );
    }
    await stopEnrollment(enrollmentId, "send-refused", now);
    return outcome(
      false,
      false,
      "send-refused",
      result.detail ?? result.skipReason ?? "Refused.",
      stepNumber,
    );
  }

  // A first contact was counted by the claim above; follow-ups increment here.
  if (claimed.prospectId && !claimsFirstContact) {
    await recordProspectContacted(claimed.prospectId);
  }
  if (claimed.leadId) {
    await recordLeadContacted(claimed.leadKind as LeadKind, claimed.leadId);
    await recordLeadActivity(
      {
        leadKind: claimed.leadKind as LeadKind,
        leadId: claimed.leadId,
        email: claimed.email,
        type: "email-sent",
        summary: `Follow-up step ${stepNumber} queued.`,
        detail: { templateKey: template.key, enrollmentId },
      },
      now,
    ).catch(() => undefined);
  }

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

/** True when this address already has a confirmed booking. */
async function hasConfirmedBooking(email: string): Promise<boolean> {
  const collection = await bookings();
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    (await collection.countDocuments({
      status: "confirmed",
      customerEmail: { $regex: new RegExp(`^${escaped}$`, "i") },
    })) > 0
  );
}

function leadName(lead: LeadDetail | null): string | null {
  if (!lead) return null;
  if (lead.kind === "consultant") {
    return typeof lead.doc.input.name === "string" ? lead.doc.input.name : null;
  }
  if (lead.kind === "enquiry") return lead.doc.name;
  return null;
}

function buildLeadVariables(
  lead: LeadDetail,
  email: string,
  options: { senderName: string; companyName: string },
): Record<string, string> {
  const doc = lead.doc;
  const name = leadName(lead) ?? email.split("@")[0] ?? "there";
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const segmentId =
    "scoreSegmentId" in doc && typeof doc.scoreSegmentId === "string"
      ? doc.scoreSegmentId
      : null;
  const segment = segmentId ? getIcpSegment(segmentId) : undefined;
  const serviceSlug = segment?.recommendedServices[0];
  const serviceName =
    services.find((service) => service.slug === serviceSlug)?.title ??
    "website and automation work";

  return {
    firstName,
    businessName: "company" in doc && doc.company ? doc.company : firstName,
    serviceName,
    bookingUrl: `${getSiteUrl()}/book-a-call`,
    unsubscribeUrl: buildUnsubscribeUrl(email, "lead"),
    senderName: options.senderName,
    companyName: options.companyName,
  };
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
