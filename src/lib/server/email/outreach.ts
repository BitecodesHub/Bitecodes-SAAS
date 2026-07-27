import "server-only";

import { createSignedToken, TOKEN_TTL } from "@/lib/server/tokens";
import { getSiteUrl } from "@/lib/server/env";
import { getSettingsFresh } from "@/lib/server/settings";
import { queueEmail, type QueueEmailResult } from "@/lib/server/email/send";
import { getTemplateForTag } from "@/lib/server/email/templates";
import { shortUrl } from "@/lib/prospecting/display";
import {
  getProspect,
  recordProspectContacted,
} from "@/lib/server/prospecting/repository";
import type { TemplateVariables } from "@/lib/email/template";
import type { ProspectDoc } from "@/lib/server/db/types";

/**
 * Turns one classified prospect into a queued outreach email.
 *
 * This is the join between Phase 3 and Phase 4: the classifier decided *why*
 * this business needs help, and that decision selects the template, fills the
 * variables, and mints the report link the email points at.
 *
 * Three refusals are deliberate and happen before anything is rendered, because
 * each one represents an email that should not exist:
 *
 * - **No classification.** Enrichment either has not run or could not reach the
 *   site. Emailing anyway would mean guessing at the recipient's problem, which
 *   is exactly the false-claim failure the enrichment honesty rules prevent.
 * - **No email address.** Nothing to send to.
 * - **Already contacted.** Re-sending a first-contact email to someone who has
 *   had one is the fastest way to become spam. Follow-ups are the sequence
 *   engine's job, not this function's.
 */

export type OutreachSkipReason =
  | "not-classified"
  | "no-email"
  | "already-contacted"
  | "no-template"
  | "suppressed-or-capped";

export type PrepareOutreachResult =
  | { ok: true; result: QueueEmailResult; templateKey: string }
  | { ok: false; reason: OutreachSkipReason; detail: string };

/**
 * Builds the variable set for one prospect.
 *
 * Exported and pure-ish so the admin preview shows exactly what will be sent,
 * rather than an approximation that could differ from the real thing.
 */
export function buildOutreachVariables(
  prospect: ProspectDoc,
  options: {
    reportUrl: string;
    unsubscribeUrl: string;
    senderName: string;
    companyName: string;
  },
): TemplateVariables {
  return {
    businessName: prospect.name,
    // Templates read `{{city}}` inside a sentence, so a missing city must not
    // leave "businesses in ." — "your area" keeps the sentence intact.
    city: prospect.city ?? "your area",
    websiteHost: shortUrl(prospect.websiteFinalUrl ?? prospect.website) || "",
    topIssue: prospect.classification?.topIssues[0] ?? "",
    reportUrl: options.reportUrl,
    unsubscribeUrl: options.unsubscribeUrl,
    senderName: options.senderName,
    companyName: options.companyName,
  };
}

/** Signed, expiring link to this prospect's personalised report. */
export function buildReportUrl(prospectId: string): string {
  const token = createSignedToken({
    purpose: "report",
    data: { id: prospectId },
    ttlSeconds: TOKEN_TTL.report,
  });
  return `${getSiteUrl()}/report/${token}`;
}

/**
 * One-click opt-out link.
 *
 * Points at `/api/unsubscribe`, not the page, because this same URL goes into the
 * `List-Unsubscribe` header and RFC 8058 requires that URI to accept a POST from
 * the mailbox provider. The endpoint redirects a human to the page, so one link
 * serves both.
 *
 * Never expires, on purpose: an unsubscribe link that has timed out is both
 * hostile and, under CAN-SPAM, non-compliant.
 */
export function buildUnsubscribeUrl(email: string, prospectId: string): string {
  const token = createSignedToken({
    purpose: "unsubscribe",
    data: { e: email, id: prospectId },
  });
  return `${getSiteUrl()}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

export async function prepareProspectOutreach(
  prospectId: string,
  options: { force?: boolean; sendAfter?: Date } = {},
): Promise<PrepareOutreachResult> {
  const prospect = await getProspect(prospectId);
  if (!prospect) {
    return {
      ok: false,
      reason: "not-classified",
      detail: "Prospect not found.",
    };
  }

  if (!prospect.classification) {
    return {
      ok: false,
      reason: "not-classified",
      detail:
        "This customer has not been checked yet, so there is no verified reason to contact them.",
    };
  }

  if (!prospect.email) {
    return {
      ok: false,
      reason: "no-email",
      detail: "No email address is known for this customer.",
    };
  }

  if (prospect.contactCount > 0 && !options.force) {
    return {
      ok: false,
      reason: "already-contacted",
      detail: `Already emailed ${prospect.contactCount} time${
        prospect.contactCount === 1 ? "" : "s"
      }. Use a follow-up sequence rather than sending first contact again.`,
    };
  }

  const template = await getTemplateForTag(prospect.classification.primaryTag);
  if (!template) {
    return {
      ok: false,
      reason: "no-template",
      detail: `No enabled template for "${prospect.classification.primaryTag}".`,
    };
  }

  const settings = await getSettingsFresh();
  const variables = buildOutreachVariables(prospect, {
    reportUrl: buildReportUrl(prospectId),
    unsubscribeUrl: buildUnsubscribeUrl(prospect.email, prospectId),
    senderName: settings.outreach.senderName,
    companyName: "Bitecodes",
  });

  const result = await queueEmail({
    to: prospect.email,
    toName: prospect.name,
    subject: template.subject,
    blocks: template.blocks,
    variables,
    category: "outreach",
    templateKey: template.key,
    prospectId,
    countryCode: prospect.countryCode,
    sendAfter: options.sendAfter,
    unsubscribeUrl: String(variables.unsubscribeUrl),
    footerNote:
      "You are receiving this because your business is publicly listed and we found something worth flagging. One click above removes you permanently.",
    track: true,
  });

  // A skipped message is a real outcome, not an error: suppression, a daily cap,
  // or the consent-region guard. Surfaced so the caller can report it.
  if (result.status === "skipped") {
    return {
      ok: false,
      reason: "suppressed-or-capped",
      detail:
        result.detail ?? `Not queued (${result.skipReason ?? "refused"}).`,
    };
  }

  // Counted at queue time rather than at delivery. Queuing is the commitment;
  // counting later would let a stalled queue produce a second first-contact
  // email to the same person.
  await recordProspectContacted(prospectId);

  return { ok: true, result, templateKey: template.key };
}

export interface BulkOutreachSummary {
  queued: number;
  skipped: Array<{
    prospectId: string;
    reason: OutreachSkipReason;
    detail: string;
  }>;
}

/**
 * Prepares outreach for many prospects.
 *
 * Sends are spaced by `sendAfter` rather than all at once. A hundred messages
 * leaving in the same second is the single clearest spam signal a new sending
 * domain can produce, and the per-message delay is what turns a burst into a
 * trickle the receiving side tolerates.
 */
export async function prepareBulkOutreach(
  prospectIds: readonly string[],
  options: { spacingSeconds?: number; startAt?: Date } = {},
): Promise<BulkOutreachSummary> {
  const spacing = Math.max(15, options.spacingSeconds ?? 90);
  const start = options.startAt ?? new Date();

  const summary: BulkOutreachSummary = { queued: 0, skipped: [] };

  // Sequential on purpose: each call reads settings and the daily cap, and
  // running them in parallel would let the batch overshoot the cap before any
  // of them observed it.
  for (const [index, prospectId] of prospectIds.entries()) {
    const sendAfter = new Date(start.getTime() + index * spacing * 1000);
    const outcome = await prepareProspectOutreach(prospectId, { sendAfter });

    if (outcome.ok) {
      summary.queued += 1;
    } else {
      summary.skipped.push({
        prospectId,
        reason: outcome.reason,
        detail: outcome.detail,
      });
    }
  }

  return summary;
}
