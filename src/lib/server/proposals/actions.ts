"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCapability } from "@/lib/server/auth/dal";
import { can } from "@/lib/server/auth/roles";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { hashIp, sha256Hex } from "@/lib/server/crypto";
import { notify } from "@/lib/server/email/notify";
import { queueEmail } from "@/lib/server/email/send";
import { kickJobs } from "@/lib/server/jobs/worker";
import { getLead } from "@/lib/server/leads/repository";
import { AutomationAiError } from "@/lib/server/ai/automation";
import { formatAmount } from "@/lib/pricing";
import { getSiteUrl } from "@/lib/server/env";
import {
  acceptProposal,
  createProposal,
  declineProposal,
  getProposal,
  markLinkedLeadWon,
  markProposalLost,
  markProposalSent,
  proposalPublicUrl,
  updateProposal,
} from "@/lib/server/proposals/repository";
import { draftProposalScope } from "@/lib/server/proposals/ai";
import {
  buildProposalPricing,
  proposalServiceTitle,
  type ProposalSelection,
} from "@/lib/proposals/pricing";
import {
  parseProposalLeadRef,
  PROPOSAL_TERMS_LINKS,
} from "@/lib/proposals/display";
import { type ProposalFormValues } from "@/lib/proposals/form";
import type { ProposalLeadRef } from "@/lib/server/db/types";
import { siteConfig } from "@/lib/site";

/**
 * Proposal server actions.
 *
 * The admin actions re-authorise with `manage_leads` because an action is a
 * public endpoint no matter which button rendered it. The two client-facing
 * actions are deliberately unauthenticated — the proposal link is the
 * credential — and are rate-limited by the hashed token instead of an IP, so
 * one forwarded link cannot be hammered from many addresses.
 */

export type ProposalActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const HOUR_MS = 60 * 60 * 1000;

const milestoneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600),
  dueOffsetDays: z.coerce.number().int().min(0).max(365),
});

const selectionSchema = z.object({
  serviceSlug: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).max(100),
});

const formSchema = z.object({
  leadRef: z.string().trim().max(120).nullable(),
  clientName: z.string().trim().max(160),
  clientEmail: z.union([z.literal(""), z.string().trim().email().max(320)]),
  company: z.string().trim().max(160),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().max(2_000),
  scope: z.array(z.string().trim().min(1).max(400)).max(12),
  deliverables: z.array(z.string().trim().min(1).max(400)).max(12),
  milestones: z.array(milestoneSchema).max(6),
  selections: z.array(selectionSchema).max(10),
  includeMaintenance: z.boolean(),
  maintenanceMonths: z.coerce.number().int().min(1).max(12),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(12),
  exclusions: z.array(z.string().trim().min(1).max(400)).max(12),
  currency: z.enum(["USD", "INR", "AUD", "GBP"]),
  aiAssisted: z.boolean().optional(),
  validUntil: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  ]),
});

function endOfDay(value: string): Date | null {
  if (!value) return null;
  return new Date(`${value}T23:59:59.999Z`);
}

function normalise(input: ProposalFormValues) {
  return {
    ...input,
    leadRef: input.leadRef || null,
    scope: input.scope.filter(Boolean),
    deliverables: input.deliverables.filter(Boolean),
    assumptions: input.assumptions.filter(Boolean),
    exclusions: input.exclusions.filter(Boolean),
    milestones: input.milestones.filter(
      (milestone) => milestone.name.trim().length > 0,
    ),
    selections: input.selections.filter(
      (selection) => selection.serviceSlug.trim().length > 0,
    ),
  };
}

/**
 * Rebuilds every price from the published source. The browser may send
 * anything; only the service slugs and quantities are trusted, and even those
 * are checked against `SERVICE_PRICING` inside `buildProposalPricing`.
 */
function priced(input: z.infer<typeof formSchema>) {
  return buildProposalPricing({
    currency: input.currency,
    selections: input.selections as ProposalSelection[],
    includeMaintenance: input.includeMaintenance,
    maintenanceMonths: input.maintenanceMonths,
    milestoneCount: input.milestones.length > 0 ? input.milestones.length : 2,
  });
}

async function clientIpHash(): Promise<string | null> {
  try {
    const headerList = await headers();
    const ip =
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerList.get("x-real-ip") ||
      null;
    return hashIp(ip);
  } catch {
    return null;
  }
}

export async function createProposalAction(
  rawInput: ProposalFormValues,
): Promise<ProposalActionResult<{ id: string }>> {
  const session = await assertCapability("manage_leads");
  const parsed = formSchema.safeParse(normalise(rawInput));
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Check the fields.");
  }

  const input = parsed.data;
  const lead = parseProposalLeadRef(input.leadRef);
  const pricing = priced(input);
  if (pricing.lineItems.length === 0) {
    return failure("Add at least one service before saving the proposal.");
  }

  const doc = await createProposal({
    leadRef: lead ? (`${lead.kind}:${lead.id}` as ProposalLeadRef) : null,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    company: input.company || null,
    title: input.title,
    summary: input.summary,
    scope: input.scope,
    deliverables: input.deliverables,
    milestones: input.milestones,
    currency: input.currency,
    lineItems: pricing.lineItems,
    total: pricing.total,
    retainerUpsell: pricing.retainerUpsell,
    paymentSchedule: pricing.paymentSchedule,
    assumptions: input.assumptions,
    exclusions: input.exclusions,
    termsLinks: PROPOSAL_TERMS_LINKS,
    validUntil: endOfDay(input.validUntil),
    createdById: session.userId,
    aiAssisted: input.aiAssisted ?? false,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.proposalCreated,
    actorId: session.userId,
    target: { type: "proposal", id: doc.proposalId },
    detail: { total: doc.total, currency: doc.currency },
  });

  revalidatePath("/admin/proposals");
  return { ok: true, data: { id: doc.proposalId } };
}

export async function updateProposalAction(
  id: string,
  rawInput: ProposalFormValues,
): Promise<ProposalActionResult<{ id: string }>> {
  const session = await assertCapability("manage_leads");
  const parsed = formSchema.safeParse(normalise(rawInput));
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Check the fields.");
  }

  const input = parsed.data;
  const lead = parseProposalLeadRef(input.leadRef);
  const pricing = priced(input);
  if (pricing.lineItems.length === 0) {
    return failure("Add at least one service before saving the proposal.");
  }

  const updated = await updateProposal(id, {
    leadRef: lead ? (`${lead.kind}:${lead.id}` as ProposalLeadRef) : null,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    company: input.company || null,
    title: input.title,
    summary: input.summary,
    scope: input.scope,
    deliverables: input.deliverables,
    milestones: input.milestones,
    currency: input.currency,
    lineItems: pricing.lineItems,
    total: pricing.total,
    retainerUpsell: pricing.retainerUpsell,
    paymentSchedule: pricing.paymentSchedule,
    assumptions: input.assumptions,
    exclusions: input.exclusions,
    termsLinks: PROPOSAL_TERMS_LINKS,
    validUntil: endOfDay(input.validUntil),
    aiAssisted: input.aiAssisted ?? false,
  });

  if (!updated) {
    return failure(
      "That proposal can no longer be edited. Accepted, declined, and expired proposals are records, not drafts.",
    );
  }

  await recordAudit({
    action: AUDIT_ACTIONS.proposalCreated,
    actorId: session.userId,
    target: { type: "proposal", id: updated.proposalId },
    detail: {
      event: "updated",
      total: updated.total,
      currency: updated.currency,
    },
  });

  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${updated.proposalId}`);
  return { ok: true, data: { id: updated.proposalId } };
}

export async function sendProposalAction(
  id: string,
): Promise<ProposalActionResult<{ status: string }>> {
  const session = await assertCapability("manage_leads");
  if (!can(session.role, "send_email")) {
    return failure(
      "Sending a proposal needs the email permission. Ask an owner or admin.",
    );
  }

  const proposal = await getProposal(id);
  if (!proposal) return failure("That proposal no longer exists.");
  if (proposal.status === "accepted" || proposal.status === "declined") {
    return failure("This proposal has already been answered.");
  }
  if (proposal.status === "expired") {
    return failure(
      "This proposal has expired. Update the validity date first.",
    );
  }

  const email = z.string().trim().email().safeParse(proposal.clientEmail);
  if (!email.success) {
    return failure(
      "Add a valid client email address before sending the proposal.",
    );
  }

  const url = proposalPublicUrl(proposal.proposalId);
  const validUntil = proposal.validUntil
    ? proposal.validUntil.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  const result = await queueEmail({
    to: email.data,
    toName: proposal.clientName || null,
    subject: `${proposal.title} — ${siteConfig.name}`,
    blocks: [
      {
        type: "p",
        text: `Hello${proposal.clientName ? ` ${proposal.clientName}` : ""},`,
      },
      {
        type: "p",
        text: `Thank you for the conversation. The proposal for ${
          proposal.company || "your project"
        } is ready to review. The total is ${formatAmount(
          proposal.total,
          proposal.currency,
        )}.`,
      },
      {
        type: "p",
        text: "You can read the full scope, deliverables, milestones, payment schedule, assumptions, and exclusions at the private link below. You can accept it there with a typed signature, or reply with any questions.",
      },
      { type: "cta", label: "Review the proposal", url },
      ...(validUntil
        ? [
            {
              type: "p" as const,
              text: `The proposal is valid until ${validUntil}.`,
            },
          ]
        : []),
      {
        type: "p",
        text: "This link is private to you. Please do not forward it publicly.",
      },
      { type: "signature", text: `${siteConfig.founder}, ${siteConfig.name}` },
    ],
    category: "transactional",
    templateKey: "proposal.sent",
    leadId: parseProposalLeadRef(proposal.leadRef)?.id ?? null,
    skipApproval: true,
    track: false,
  });

  if (result.status === "skipped") {
    return failure(
      result.detail ??
        `The proposal email was not sent (${result.skipReason ?? "refused"}).`,
    );
  }

  const sent = await markProposalSent(proposal.proposalId);
  if (!sent) return failure("The proposal could not be marked as sent.");

  await recordAudit({
    action: AUDIT_ACTIONS.proposalSent,
    actorId: session.userId,
    target: { type: "proposal", id: proposal.proposalId },
    detail: { total: proposal.total, currency: proposal.currency },
  });

  after(() => kickJobs(15_000));
  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${proposal.proposalId}`);
  return { ok: true, data: { status: result.status } };
}

export async function markProposalLostAction(
  id: string,
  reason: string,
): Promise<ProposalActionResult> {
  await assertCapability("manage_leads");
  const parsedReason = z.string().trim().min(3).max(600).safeParse(reason);
  if (!parsedReason.success) {
    return failure("Write a short reason so the record explains itself.");
  }

  const proposal = await getProposal(id);
  if (!proposal) return failure("That proposal no longer exists.");

  const lost = await markProposalLost(proposal.proposalId, parsedReason.data);
  if (!lost) return failure("This proposal has already been answered.");

  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${proposal.proposalId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI draft
// ---------------------------------------------------------------------------

const draftRequestSchema = z.object({
  leadRef: z.string().trim().max(120).nullable(),
  title: z.string().trim().max(180),
  clientName: z.string().trim().max(160),
  company: z.string().trim().max(160),
  selectedServiceSlugs: z.array(z.string().trim().min(1).max(80)).max(10),
  operatorNotes: z.string().trim().max(4_000),
});

export type ProposalDraftRequest = z.infer<typeof draftRequestSchema>;

/** Compacts the linked lead into the untrusted brief the model may read. */
async function loadLeadBrief(leadRef: string | null): Promise<string | null> {
  const parsed = parseProposalLeadRef(leadRef);
  if (!parsed) return null;
  const lead = await getLead(parsed.kind, parsed.id);
  if (!lead) return null;

  if (lead.kind === "enquiry") {
    return [
      `Contact enquiry: ${lead.doc.message}`,
      lead.doc.budget ? `Stated budget: ${lead.doc.budget}` : "",
      lead.doc.source ? `Source: ${lead.doc.source}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (lead.kind === "consultant") {
    return [
      `Consultant brief: ${JSON.stringify(lead.doc.input)}`,
      lead.doc.recommendation
        ? `Consultant recommendation: ${JSON.stringify(lead.doc.recommendation)}`
        : "",
      lead.doc.quote
        ? `Deterministic quote range: ${JSON.stringify(lead.doc.quote)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (lead.kind !== "audit") return null;

  const result = lead.doc.result;
  return [
    `Website audit of ${lead.doc.auditedUrl}.`,
    result ? `Overall score: ${result.overallScore}/100.` : "",
    result?.findings?.length
      ? `Findings: ${result.findings
          .slice(0, 12)
          .map((finding) => `${finding.title} (${finding.status})`)
          .join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function aiDraftProposalAction(
  request: ProposalDraftRequest,
): Promise<ProposalActionResult<{ draft: unknown }>> {
  await assertCapability("manage_leads");
  const parsed = draftRequestSchema.safeParse(request);
  if (!parsed.success) {
    return failure("Check the proposal details before drafting.");
  }

  try {
    const result = await draftProposalScope({
      title: parsed.data.title,
      clientName: parsed.data.clientName,
      company: parsed.data.company,
      selectedServices:
        parsed.data.selectedServiceSlugs.map(proposalServiceTitle),
      leadBrief: await loadLeadBrief(parsed.data.leadRef),
      operatorNotes: parsed.data.operatorNotes || null,
    });
    return { ok: true, data: { draft: result.draft } };
  } catch (error) {
    if (error instanceof AutomationAiError) {
      return failure(
        error.code === "DISABLED"
          ? "AI automation is switched off in settings."
          : error.code === "NOT_CONFIGURED"
            ? "No AI provider is configured. Add one in the desktop panel."
            : "The AI provider could not produce a valid draft. Try again, or write the section yourself.",
      );
    }
    return failure(
      "The AI draft failed. Try again, or write the section yourself.",
    );
  }
}

// ---------------------------------------------------------------------------
// Public actions (no login; the token is the credential)
// ---------------------------------------------------------------------------

const acceptSchema = z.object({
  name: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(160),
  accepted: z.literal(true),
  signature: z.string().trim().min(2).max(160),
});

export type ProposalAcceptInput = z.infer<typeof acceptSchema>;

export async function acceptProposalAction(
  token: string,
  input: ProposalAcceptInput,
): Promise<ProposalActionResult<{ proposalId: string }>> {
  if (typeof token !== "string" || token.length < 32 || token.length > 128) {
    return failure("This proposal link is not valid.");
  }
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      parsed.error.issues[0]?.message ?? "Complete every acceptance field.",
    );
  }

  const { consumeRateLimit } = await import("@/lib/server/rate-limit");
  const limited = await consumeRateLimit({
    bucket: "proposal-accept",
    key: sha256Hex(token).slice(0, 40),
    max: 10,
    windowMs: HOUR_MS,
  });
  if (!limited.allowed) {
    return failure("Too many attempts. Please try again later.");
  }

  const result = await acceptProposal(token, {
    name: parsed.data.name,
    title: parsed.data.title,
    signature: parsed.data.signature,
    ipHash: await clientIpHash(),
  });
  if (!result.ok) {
    return failure(
      result.reason === "expired"
        ? "This proposal has expired. Ask us for an updated one."
        : result.reason === "not-open"
          ? "This proposal has already been answered."
          : "This proposal link is not valid.",
    );
  }

  const proposal = result.proposal;
  const leadWon = await markLinkedLeadWon(proposal.leadRef);

  try {
    await notify({
      channel: "formSubmission",
      subject: `Proposal accepted — ${proposal.company || proposal.clientName || proposal.proposalId}`,
      blocks: [
        {
          type: "p",
          text: `${proposal.clientName || "The client"} accepted "${proposal.title}" for ${formatAmount(proposal.total, proposal.currency)}.`,
        },
        {
          type: "p",
          text: `${parsed.data.name} signed as ${parsed.data.title}.${leadWon ? " The linked lead was moved to Won." : ""}`,
        },
        {
          type: "cta",
          label: "Open the proposal record",
          url: `${getSiteUrl()}/admin/proposals/${proposal.proposalId}`,
        },
      ],
      subjectId: proposal.proposalId,
    });
  } catch {
    // A failed owner notification must not turn a valid acceptance into an
    // error the client sees; the record is already saved.
  }

  const lead = parseProposalLeadRef(proposal.leadRef);
  if (lead) {
    await recordAudit({
      action: AUDIT_ACTIONS.leadStageChanged,
      actorId: null,
      target: { type: lead.kind, id: lead.id },
      detail: { stage: "won", via: "proposal-acceptance" },
    });
  }

  revalidatePath(`/proposal/${token}`);
  revalidatePath("/admin/proposals");
  return { ok: true, data: { proposalId: proposal.proposalId } };
}

export async function declineProposalAction(
  token: string,
  reason: string,
): Promise<ProposalActionResult> {
  if (typeof token !== "string" || token.length < 32 || token.length > 128) {
    return failure("This proposal link is not valid.");
  }
  const parsedReason = z.string().trim().min(3).max(1_000).safeParse(reason);
  if (!parsedReason.success) {
    return failure("Please tell us briefly why the proposal is not a fit.");
  }

  const { consumeRateLimit } = await import("@/lib/server/rate-limit");
  const limited = await consumeRateLimit({
    bucket: "proposal-decline",
    key: sha256Hex(token).slice(0, 40),
    max: 10,
    windowMs: HOUR_MS,
  });
  if (!limited.allowed) {
    return failure("Too many attempts. Please try again later.");
  }

  const result = await declineProposal(
    token,
    parsedReason.data,
    await clientIpHash(),
  );
  if (!result.ok) {
    return failure(
      result.reason === "expired"
        ? "This proposal has expired."
        : result.reason === "not-open"
          ? "This proposal has already been answered."
          : "This proposal link is not valid.",
    );
  }

  const proposal = result.proposal;
  try {
    await notify({
      channel: "formSubmission",
      subject: `Proposal declined — ${proposal.company || proposal.clientName || proposal.proposalId}`,
      blocks: [
        {
          type: "p",
          text: `${proposal.clientName || "The client"} declined "${proposal.title}".`,
        },
        { type: "p", text: `Reason given: ${parsedReason.data}` },
        {
          type: "cta",
          label: "Open the proposal record",
          url: `${getSiteUrl()}/admin/proposals/${proposal.proposalId}`,
        },
      ],
      subjectId: proposal.proposalId,
    });
  } catch {
    // The decision is recorded; the notification is best effort.
  }

  revalidatePath(`/proposal/${token}`);
  revalidatePath("/admin/proposals");
  return { ok: true };
}
