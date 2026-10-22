"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertCapability, getCurrentAdminUser } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { kickJobs } from "@/lib/server/jobs/worker";
import { queueEmail } from "@/lib/server/email/send";
import {
  addLeadNote,
  assignLead,
  getLead,
  isWritableLeadKind,
  LEAD_STAGES,
  listLeadsForExport,
  recordLeadActivity,
  recordLeadContacted,
  setLeadNextAction,
  setLeadOwnerNotes,
  setLeadStage,
  setLeadStatus,
  toCsv,
  type LeadKind,
  type LeadQuery,
} from "@/lib/server/leads/repository";
import { captureLead } from "@/lib/server/leads/capture";
import { contactEnquiries } from "@/lib/server/db/collections";
import {
  getProspect,
  setProspectStatus,
} from "@/lib/server/prospecting/repository";
import { enrollLead } from "@/lib/server/email/sequences";
import type { LeadStage, LeadStatus } from "@/lib/server/db/types";

/**
 * Server Actions for the leads inbox.
 *
 * Same contract as the prospecting actions: Origin-checked by Next, and every
 * one re-authorises through `assertCapability` because an action is a public
 * endpoint regardless of which buttons the UI renders.
 */

export type LeadActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const LEGACY_STATUSES: LeadStatus[] = [
  "new",
  "qualified",
  "proposal",
  "won",
  "lost",
  "spam",
];

const KINDS: LeadKind[] = ["enquiry", "consultant", "audit", "form", "booking"];

function parseKind(value: string): LeadKind | null {
  return KINDS.includes(value as LeadKind) ? (value as LeadKind) : null;
}

export async function setLeadStatusAction(
  kind: string,
  ids: string[],
  status: string,
): Promise<LeadActionResult<{ changed: number }>> {
  const session = await assertCapability("manage_leads");

  const leadKind = parseKind(kind);
  if (!leadKind) return failure("That is not a valid lead source.");
  if (!isWritableLeadKind(leadKind)) {
    return failure("Form submissions and bookings are read-only in the CRM.");
  }
  if (ids.length === 0) return failure("Select at least one lead.");

  let changed: number;
  if (LEAD_STAGES.includes(status as LeadStage)) {
    changed = await setLeadStage(leadKind, ids, status as LeadStage);
  } else if (LEGACY_STATUSES.includes(status as LeadStatus)) {
    changed = await setLeadStatus(leadKind, ids, status as LeadStatus);
  } else {
    return failure("That is not a valid lead stage.");
  }

  await recordAudit({
    action: AUDIT_ACTIONS.leadStatusChanged,
    actorId: session.userId,
    detail: { kind: leadKind, status, count: changed },
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/pipeline");
  return { ok: true, data: { changed } };
}

/** Explicit stage move used by the pipeline board. */
export async function setLeadStageAction(
  kind: string,
  ids: string[],
  stage: string,
): Promise<LeadActionResult<{ changed: number }>> {
  const session = await assertCapability("manage_leads");

  const leadKind = parseKind(kind);
  if (!leadKind) return failure("That is not a valid lead source.");
  if (!isWritableLeadKind(leadKind)) {
    return failure("Form submissions and bookings are read-only in the CRM.");
  }
  if (!LEAD_STAGES.includes(stage as LeadStage)) {
    return failure("That is not a valid stage.");
  }
  if (ids.length === 0) return failure("Select at least one lead.");

  const changed = await setLeadStage(leadKind, ids, stage as LeadStage);
  await recordAudit({
    action: AUDIT_ACTIONS.leadStatusChanged,
    actorId: session.userId,
    detail: { kind: leadKind, stage, count: changed },
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/pipeline");
  for (const id of ids) revalidatePath(`/admin/leads/${leadKind}/${id}`);
  return { ok: true, data: { changed } };
}

const nextActionSchema = z.object({
  nextAction: z.string().trim().max(240),
  nextActionAt: z.string().trim().max(40),
});

/** Saves the next concrete step and its due date. */
export async function setLeadNextActionAction(
  kind: string,
  id: string,
  nextAction: string,
  nextActionAt: string,
): Promise<LeadActionResult> {
  const session = await assertCapability("manage_leads");
  const leadKind = parseKind(kind);
  if (!leadKind || !isWritableLeadKind(leadKind)) {
    return failure("That lead cannot be edited here.");
  }

  const parsed = nextActionSchema.safeParse({ nextAction, nextActionAt });
  if (!parsed.success) return failure("Check the next action and date.");

  let due: Date | null = null;
  if (parsed.data.nextActionAt) {
    const value = /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.nextActionAt)
      ? `${parsed.data.nextActionAt}T09:00:00.000Z`
      : parsed.data.nextActionAt;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return failure("That deadline is not a valid date.");
    }
    due = date;
  }

  const saved = await setLeadNextAction(
    leadKind,
    id,
    parsed.data.nextAction || null,
    due,
  );
  if (!saved) return failure("That lead no longer exists.");

  await recordLeadActivity({
    leadKind,
    leadId: id,
    email: null,
    type: "next-action",
    summary: parsed.data.nextAction
      ? `Next action set: ${parsed.data.nextAction}`
      : "Next action cleared.",
    detail: { nextActionAt: due?.toISOString() ?? null },
    actorId: session.userId,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.leadNoteAdded,
    actorId: session.userId,
    target: { type: leadKind, id },
    detail: { nextActionAt: due?.toISOString() ?? null },
  });

  revalidatePath(`/admin/leads/${leadKind}/${id}`);
  revalidatePath("/admin/leads/pipeline");
  return { ok: true };
}

const ownerNotesSchema = z.object({ notes: z.string().max(8_000) });

/** Private operator notes. Separate from the shared timeline. */
export async function setLeadOwnerNotesAction(
  kind: string,
  id: string,
  notes: string,
): Promise<LeadActionResult> {
  const session = await assertCapability("manage_leads");
  const leadKind = parseKind(kind);
  if (!leadKind || !isWritableLeadKind(leadKind)) {
    return failure("That lead cannot be edited here.");
  }

  const parsed = ownerNotesSchema.safeParse({ notes });
  if (!parsed.success) return failure("That note is too long.");

  const saved = await setLeadOwnerNotes(leadKind, id, parsed.data.notes);
  if (!saved) return failure("That lead no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.leadNoteAdded,
    actorId: session.userId,
    target: { type: leadKind, id },
  });

  revalidatePath(`/admin/leads/${leadKind}/${id}`);
  return { ok: true };
}

/**
 * Opts one lead into the inbound follow-up sequence.
 *
 * The consent check is in the sequence engine, not here: there is exactly one
 * place that decides whether a send has a lawful basis, and duplicating it in
 * the UI would eventually drift.
 */
export async function enrollLeadAction(
  kind: string,
  id: string,
): Promise<LeadActionResult<{ alreadyEnrolled: boolean }>> {
  const session = await assertCapability("manage_leads");
  const leadKind = parseKind(kind);
  if (!leadKind || !isWritableLeadKind(leadKind)) {
    return failure("That lead cannot be enrolled.");
  }

  const lead = await getLead(leadKind, id);
  if (!lead || lead.kind === "form" || lead.kind === "booking") {
    return failure("That lead can no longer be enrolled.");
  }
  if (!lead.doc.email) return failure("This lead has no email address.");
  if (lead.doc.consent?.marketing !== true) {
    return failure("This person did not opt in to follow-up email.");
  }

  const result = await enrollLead({
    leadKind,
    leadId: id,
    email: lead.doc.email,
    name: lead.kind === "enquiry" ? lead.doc.name : null,
    consentAt: lead.doc.consent?.at ?? null,
  });

  if (!result.ok) {
    if (result.reason === "already-enrolled") {
      return { ok: true, data: { alreadyEnrolled: true } };
    }
    return failure(result.detail);
  }

  await recordAudit({
    action: AUDIT_ACTIONS.sequenceEnrolled,
    actorId: session.userId,
    target: { type: leadKind, id },
    detail: { sequence: "inbound.followup", enrollmentId: result.enrollmentId },
  });
  revalidatePath(`/admin/leads/${leadKind}/${id}`);
  return { ok: true, data: { alreadyEnrolled: false } };
}

export async function assignLeadAction(
  kind: string,
  id: string,
  assignedToId: string | null,
): Promise<LeadActionResult> {
  const session = await assertCapability("manage_leads");

  const leadKind = parseKind(kind);
  if (!leadKind) return failure("That is not a valid lead source.");
  if (!isWritableLeadKind(leadKind)) {
    return failure("Form submissions and bookings are read-only.");
  }

  const assigned = await assignLead(leadKind, id, assignedToId || null);
  if (!assigned) return failure("That lead no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.leadAssigned,
    actorId: session.userId,
    target: { type: leadKind, id },
    detail: { assignedToId },
  });

  revalidatePath(`/admin/leads/${leadKind}/${id}`);
  revalidatePath("/admin/leads");
  return { ok: true };
}

const noteSchema = z.object({ body: z.string().trim().min(1).max(4_000) });

export async function addLeadNoteAction(
  kind: string,
  id: string,
  body: string,
): Promise<LeadActionResult> {
  const session = await assertCapability("manage_leads");

  const leadKind = parseKind(kind);
  if (!leadKind) return failure("That is not a valid lead source.");
  if (!isWritableLeadKind(leadKind)) {
    return failure("Form submissions and bookings are read-only.");
  }

  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) return failure("Write a note before saving.");

  const user = await getCurrentAdminUser();
  const added = await addLeadNote(leadKind, id, {
    authorId: session.userId,
    authorName: user?.name ?? user?.email ?? "Admin",
    body: parsed.data.body,
  });
  if (!added) return failure("That lead no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.leadNoteAdded,
    actorId: session.userId,
    target: { type: leadKind, id },
  });

  revalidatePath(`/admin/leads/${leadKind}/${id}`);
  return { ok: true };
}

const replySchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(20_000),
});

/**
 * Replies to a lead from inside the panel.
 *
 * Queued through the same pipeline as every other message rather than sent
 * inline, so it inherits suppression checks, the sent log, and retry on SMTP
 * failure. `skipApproval` is set because this is a human deliberately answering
 * a person who contacted us first — the approval gate exists for bulk cold
 * outreach, and making an operator approve their own reply would be theatre.
 *
 * Tracking is off for the same reason: this is a conversation, not a campaign.
 */
export async function replyToLeadAction(
  kind: string,
  id: string,
  subject: string,
  body: string,
): Promise<LeadActionResult<{ status: string; detail: string | null }>> {
  const session = await assertCapability("send_email");

  const leadKind = parseKind(kind);
  if (!leadKind) return failure("That is not a valid lead source.");

  const parsed = replySchema.safeParse({ subject, body });
  if (!parsed.success) {
    return failure("Add a subject and a message of at least ten characters.");
  }

  const lead = await getLead(leadKind, id);
  if (!lead || lead.kind === "form" || lead.kind === "booking") {
    return failure("That lead can no longer be answered.");
  }

  // All three lead shapes carry `email` at the top level, so no per-kind branch
  // is needed here. The consultant's brief may also contain one, but `doc.email`
  // is already the resolved value written at capture time.
  const to = lead.doc.email;

  if (!to) {
    return failure(
      "This lead has no email address, so there is nobody to reply to.",
    );
  }

  const name = lead.kind === "enquiry" ? lead.doc.name : null;

  const result = await queueEmail({
    to,
    toName: name,
    subject: parsed.data.subject,
    // Split on blank lines so an operator's plain typing becomes paragraphs
    // rather than one wall of text.
    blocks: parsed.data.body
      .split(/\n{2,}/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ type: "p" as const, text })),
    category: "transactional",
    leadId: id,
    skipApproval: true,
    track: false,
  });

  // `queueEmail` reports a refusal as `skipped` plus a `skipReason`, not as a
  // distinct status. Surfacing it as a failure matters: an operator who thinks
  // their reply went out and hears nothing back will assume the lead ghosted
  // them, when in fact the address was suppressed or undeliverable.
  if (result.status === "skipped") {
    return failure(
      result.detail ??
        `This reply was not sent (${result.skipReason ?? "refused"}).`,
    );
  }

  await recordLeadContacted(leadKind, id);
  await addLeadNote(leadKind, id, {
    authorId: session.userId,
    authorName: "Reply sent",
    body: `Subject: ${parsed.data.subject}\n\n${parsed.data.body}`,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.leadReplied,
    actorId: session.userId,
    target: { type: leadKind, id },
    detail: { subject: parsed.data.subject },
  });

  // Deliver now rather than waiting for the next cron tick: a reply an operator
  // just wrote should leave immediately.
  after(() => kickJobs(15_000));

  revalidatePath(`/admin/leads/${leadKind}/${id}`);
  return { ok: true, data: { status: result.status, detail: result.detail } };
}

/**
 * Converts a qualified prospect into an inbox lead.
 *
 * The prospect's public facts become a normal enquiry, which means it inherits
 * the same scoring, timeline, and proposal hand-off as an inbound form. The
 * prospect is marked qualified and the link is kept in `detail.prospectId`, so
 * the conversion is auditable and cannot be repeated by accident.
 */
export async function convertProspectToLeadAction(
  prospectId: string,
): Promise<LeadActionResult<{ id: string; alreadyConverted: boolean }>> {
  const session = await assertCapability("manage_leads");

  const prospect = await getProspect(prospectId);
  if (!prospect) return failure("That prospect no longer exists.");

  const existing = await (
    await contactEnquiries()
  ).findOne({
    source: "prospect-conversion",
    "detail.prospectId": prospectId,
  });
  if (existing?._id) {
    return {
      ok: true,
      data: { id: existing._id.toHexString(), alreadyConverted: true },
    };
  }

  const issue = prospect.classification?.topIssues[0] ?? null;
  const angle = prospect.classification?.pitchAngles[0] ?? null;
  const message = [
    `Converted from prospecting: ${prospect.name}.`,
    issue ? `Observed issue: ${issue}.` : null,
    angle ? `Angle: ${angle}.` : null,
    prospect.city ? `Location: ${prospect.city}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const captured = await captureLead({
    kind: "prospect",
    source: "prospect-conversion",
    name: prospect.name,
    email: prospect.email,
    phone: prospect.phone,
    company: prospect.name,
    message,
    country: prospect.countryCode,
    consent: {
      contact: true,
      marketing: false,
      text: "Converted by an operator from a qualified prospect.",
    },
    detail: {
      prospectId,
      classification: prospect.classification?.primaryTag ?? null,
      audienceCountry: prospect.countryCode,
    },
  });

  await setProspectStatus([prospectId], "qualified");
  await recordLeadActivity({
    leadKind: "enquiry",
    leadId: captured.id,
    email: prospect.email,
    type: "converted",
    summary: `Converted from prospect ${prospect.name}.`,
    detail: { prospectId },
    actorId: session.userId,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.leadStatusChanged,
    actorId: session.userId,
    target: { type: "prospect", id: prospectId },
    detail: { convertedTo: captured.id, source: "prospect-conversion" },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/enquiry/${captured.id}`);
  revalidatePath(`/admin/prospects/${prospectId}`);
  return {
    ok: true,
    data: { id: captured.id, alreadyConverted: !captured.created },
  };
}

/**
 * Exports the current view as CSV.
 *
 * Returns the text rather than a file response because a Server Action cannot
 * stream a download; the client turns it into a Blob. The row cap lives in the
 * repository so one click cannot pull an unbounded result set into memory.
 */
export async function exportLeadsAction(
  query: LeadQuery,
): Promise<LeadActionResult<{ csv: string; rows: number; filename: string }>> {
  await assertCapability("manage_leads");

  const rows = await listLeadsForExport({
    search: query.search,
    status: query.status,
    kind: query.kind,
    assignedToId: query.assignedToId,
  });

  // Date is formed here rather than in the repository so the filename is stable
  // for a given export and the repository stays free of presentation concerns.
  const stamp = new Date().toISOString().slice(0, 10);

  return {
    ok: true,
    data: {
      csv: toCsv(rows),
      rows: rows.length,
      filename: `${stamp}_Bitecodes-leads_v1.csv`,
    },
  };
}
