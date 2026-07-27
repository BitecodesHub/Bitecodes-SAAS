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
  LEAD_STATUSES,
  listLeadsForExport,
  recordLeadContacted,
  setLeadStatus,
  toCsv,
  type LeadKind,
  type LeadQuery,
} from "@/lib/server/leads/repository";
import type { LeadStatus } from "@/lib/server/db/types";

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

const KINDS: LeadKind[] = ["enquiry", "consultant", "audit"];

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
  if (!LEAD_STATUSES.includes(status as LeadStatus)) {
    return failure("That is not a valid lead stage.");
  }
  if (ids.length === 0) return failure("Select at least one lead.");

  const changed = await setLeadStatus(leadKind, ids, status as LeadStatus);

  await recordAudit({
    action: AUDIT_ACTIONS.leadStatusChanged,
    actorId: session.userId,
    detail: { kind: leadKind, status, count: changed },
  });

  revalidatePath("/admin/leads");
  return { ok: true, data: { changed } };
}

export async function assignLeadAction(
  kind: string,
  id: string,
  assignedToId: string | null,
): Promise<LeadActionResult> {
  const session = await assertCapability("manage_leads");

  const leadKind = parseKind(kind);
  if (!leadKind) return failure("That is not a valid lead source.");

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
  if (!lead) return failure("That lead no longer exists.");

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
