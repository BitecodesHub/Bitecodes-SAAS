import "server-only";

import { randomUUID } from "node:crypto";
import { emailMessages } from "@/lib/server/db/collections";
import type {
  EmailMessageDoc,
  EmailMessageStatus,
  EmailTemplateDoc,
} from "@/lib/server/db/types";
import type { EmailBlock } from "@/lib/email/template";
import { renderEmail, type TemplateVariables } from "@/lib/email/template";
import { appendOpenPixel, rewriteLinksForTracking } from "@/lib/email/tracking";
import {
  emailDomain,
  isDeliverableEmail,
  isNeverContactAddress,
  normalizeEmail,
} from "@/lib/email/address";
import { evaluateOutreachGate } from "@/lib/email/compliance";
import { isSuppressed } from "@/lib/server/email/suppression";
import { getTransporter } from "@/lib/server/email/transport";
import { getSettingsFresh } from "@/lib/server/settings";
import { getServerEnv, getSiteUrl } from "@/lib/server/env";
import { createSignedToken } from "@/lib/server/tokens";
import { enqueueJob, JOB_TYPES } from "@/lib/server/jobs/queue";

/**
 * The outbound email pipeline.
 *
 * Every message the application sends goes through here, and every compliance
 * and deliverability rule is enforced here rather than at the call site — a
 * rule that each caller has to remember is a rule that will eventually be
 * forgotten by one of them.
 *
 * Two categories, with deliberately different rules:
 *
 * - **transactional** — a reply to something the recipient did (enquiry
 *   acknowledgement, report they asked for, onboarding link). Sent immediately,
 *   exempt from daily caps and the region guard, because it is requested mail.
 * - **outreach / nurture** — commercial mail the recipient did not ask for.
 *   Passes the full gate in `email/compliance.ts`, is throttled, carries an
 *   unsubscribe link and postal address, and defaults to requiring human
 *   approval.
 *
 * A message is persisted *before* any send attempt, so a crash mid-send leaves
 * an auditable record rather than an invisible gap.
 */

export interface QueueEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  blocks: EmailBlock[];
  variables?: TemplateVariables;
  category: EmailTemplateDoc["category"];
  templateKey?: string | null;
  prospectId?: string | null;
  leadId?: string | null;
  enrollmentId?: string | null;
  sequenceStep?: number | null;
  /** Provider country code, used by the consent-region guard. */
  countryCode?: string | null;
  /** Earliest send time. Used to space out a batch. */
  sendAfter?: Date;
  /** Set for outreach so the recipient can opt out. */
  unsubscribeUrl?: string | null;
  footerNote?: string | null;
  /** Overrides the approval gate. Only for explicit one-off admin sends. */
  skipApproval?: boolean;
  /** Adds open and click tracking. Off for transactional mail. */
  track?: boolean;
}

export interface QueueEmailResult {
  messageId: string;
  status: EmailMessageStatus;
  skipReason: string | null;
  detail: string | null;
}

/**
 * Renders, gates, and persists a message. Does not send: the worker does that,
 * so a slow or failing SMTP server never blocks a web request.
 */
export async function queueEmail(
  input: QueueEmailInput,
): Promise<QueueEmailResult> {
  // Fresh rather than cached: the postal address and the caps are compliance
  // inputs, and a stale-while-revalidate read could return the pre-change value.
  const settings = await getSettingsFresh();
  const env = getServerEnv();
  const to = normalizeEmail(input.to);
  const isCommercial =
    input.category === "outreach" || input.category === "nurture";

  const postalAddress = settings.contact.address.postal || null;
  const rendered = renderEmail({
    subject: input.subject,
    blocks: input.blocks,
    variables: input.variables ?? {},
    shell: {
      postalAddress: isCommercial ? postalAddress : null,
      unsubscribeUrl: input.unsubscribeUrl ?? null,
      footerNote: input.footerNote ?? null,
    },
  });

  const trackingId = randomUUID();
  const messageId = randomUUID();

  const from =
    (isCommercial ? settings.outreach.fromAddress : null) ?? env.SMTP_FROM;
  const replyTo = isCommercial
    ? (settings.outreach.replyTo ?? env.CONTACT_NOTIFICATION_TO[0] ?? null)
    : (env.CONTACT_NOTIFICATION_TO[0] ?? null);

  let status: EmailMessageStatus = "queued";
  let skipReason: string | null = null;
  let detail: string | null = null;

  if (isCommercial) {
    const [suppressed, domainSentToday, globalSentToday] = await Promise.all([
      isSuppressed(to),
      countSentToday(emailDomain(to)),
      countSentToday(null),
    ]);

    const gate = evaluateOutreachGate({
      email: to,
      countryCode: input.countryCode ?? null,
      suppressed,
      deliverable: isDeliverableEmail(to),
      neverContact: isNeverContactAddress(to),
      domainSentToday,
      globalSentToday,
      perDomainDailyCap: settings.automation.perDomainDailyCap,
      globalDailyCap: settings.automation.globalDailyCap,
      blockConsentRequiredRegions:
        settings.automation.blockConsentRequiredRegions,
      hasPostalAddress: Boolean(postalAddress),
      hasUnsubscribeUrl: Boolean(input.unsubscribeUrl),
      missingVariables: rendered.missing,
    });

    if (!gate.allowed) {
      status = "skipped";
      skipReason = gate.reason;
      detail = gate.detail;
    } else if (settings.automation.requireApproval && !input.skipApproval) {
      // The default. A human confirms the batch before anything leaves.
      status = "pending_approval";
    }
  } else {
    // Transactional mail still respects hard blocks: an undeliverable address
    // is a guaranteed bounce, and an automated mailbox must never be replied to.
    if (!isDeliverableEmail(to)) {
      status = "skipped";
      skipReason = "undeliverable";
      detail = "The address does not look deliverable.";
    } else if (isNeverContactAddress(to)) {
      status = "skipped";
      skipReason = "never-contact";
      detail = "The address is an automated mailbox.";
    } else if (rendered.missing.length > 0) {
      status = "skipped";
      skipReason = "incomplete-template";
      detail = `Missing values for: ${rendered.missing.join(", ")}.`;
    }
  }

  const now = new Date();
  const document: Omit<EmailMessageDoc, "_id"> = {
    messageId,
    to,
    toName: input.toName ?? null,
    from,
    replyTo,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateKey: input.templateKey ?? null,
    category: input.category,
    status,
    skipReason,
    prospectId: input.prospectId ?? null,
    leadId: input.leadId ?? null,
    enrollmentId: input.enrollmentId ?? null,
    sequenceStep: input.sequenceStep ?? null,
    approvedById: null,
    approvedAt: null,
    sendAfter: input.sendAfter ?? now,
    sentAt: null,
    failedAt: null,
    lastError: detail,
    attempts: 0,
    providerMessageId: null,
    opens: [],
    clicks: [],
    trackingId,
    createdAt: now,
    updatedAt: now,
  };

  const collection = await emailMessages();
  await collection.insertOne(document as EmailMessageDoc);

  if (status === "queued") {
    await enqueueJob({
      type: JOB_TYPES.emailSend,
      payload: { messageId, track: input.track ?? isCommercial },
      runAt: document.sendAfter,
      idempotencyKey: `email:${messageId}`,
    });
  }

  return { messageId, status, skipReason, detail };
}

/**
 * Counts messages actually sent since midnight UTC, for the daily caps.
 *
 * Counts sends rather than queued messages: a queue that backs up must not
 * silently consume the day's budget with mail that never left.
 */
export async function countSentToday(
  domain: string | null,
  now = new Date(),
): Promise<number> {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const collection = await emailMessages();
  const filter: Record<string, unknown> = {
    status: "sent",
    sentAt: { $gte: startOfDay },
    category: { $in: ["outreach", "nurture"] },
  };
  if (domain) filter.to = { $regex: `@${escapeRegex(domain)}$` };

  return collection.countDocuments(filter);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export interface DeliverResult {
  sent: boolean;
  skipped: boolean;
  reason: string | null;
}

/**
 * Sends one persisted message.
 *
 * Re-checks suppression immediately before sending. The message may have sat in
 * the queue for hours, and someone who unsubscribed in the meantime must not
 * receive it — checking only at queue time would send it anyway.
 */
export async function deliverMessage(
  messageId: string,
  options: { track?: boolean } = {},
): Promise<DeliverResult> {
  const collection = await emailMessages();
  const now = new Date();

  // Claim the message so two workers cannot both send it.
  const claimed = await collection.findOneAndUpdate(
    { messageId, status: { $in: ["queued", "sending"] } },
    { $set: { status: "sending", updatedAt: now }, $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    return { sent: false, skipped: true, reason: "not-queued" };
  }

  const isCommercial =
    claimed.category === "outreach" || claimed.category === "nurture";

  if (isCommercial && (await isSuppressed(claimed.to))) {
    await collection.updateOne(
      { messageId },
      {
        $set: {
          status: "skipped",
          skipReason: "suppressed",
          lastError: "The recipient unsubscribed before this message was sent.",
          updatedAt: new Date(),
        },
      },
    );
    return { sent: false, skipped: true, reason: "suppressed" };
  }

  const siteUrl = getSiteUrl();
  let html = claimed.html;

  if (options.track ?? isCommercial) {
    html = addTracking(html, claimed.trackingId, siteUrl);
  }

  const headers: Record<string, string> = {};
  const unsubscribeUrl = extractUnsubscribeUrl(claimed.html);
  if (unsubscribeUrl) {
    // RFC 8058 one-click unsubscribe. Gmail and Outlook surface this as a
    // native button, which is far more likely to be used than a footer link —
    // and an easy unsubscribe protects sender reputation.
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const info = await getTransporter().sendMail({
      from: claimed.from,
      to: claimed.toName
        ? `"${sanitizeName(claimed.toName)}" <${claimed.to}>`
        : claimed.to,
      replyTo: claimed.replyTo ?? undefined,
      subject: claimed.subject,
      text: claimed.text,
      html,
      headers,
    });

    await collection.updateOne(
      { messageId },
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
          providerMessageId: info.messageId ?? null,
          lastError: null,
          updatedAt: new Date(),
        },
      },
    );
    return { sent: true, skipped: false, reason: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    await collection.updateOne(
      { messageId },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          lastError: message.slice(0, 1_000),
          updatedAt: new Date(),
        },
      },
    );
    // Rethrown so the job queue records the failure and applies backoff.
    throw error;
  }
}

/** Quotes are stripped so a display name cannot break out of the header. */
function sanitizeName(name: string) {
  return name.replace(/["\\\r\n]/g, "").slice(0, 78);
}

function addTracking(
  html: string,
  trackingId: string,
  siteUrl: string,
): string {
  const { html: rewritten } = rewriteLinksForTracking(html, {
    makeClickUrl: (destination) => {
      // The destination travels inside a signed token, so the redirect handler
      // can refuse any URL it did not issue. An unsigned `?u=` parameter would
      // be an open redirect on the sending domain.
      const token = createSignedToken({
        purpose: "email-click",
        data: { m: trackingId, u: destination },
      });
      return `${siteUrl}/e/c/${token}`;
    },
  });

  const openToken = createSignedToken({
    purpose: "email-open",
    data: { m: trackingId },
  });
  return appendOpenPixel(rewritten, `${siteUrl}/e/o/${openToken}`);
}

/** Recovers the unsubscribe URL from rendered HTML for the header. */
function extractUnsubscribeUrl(html: string): string | null {
  const match = html.match(/href="([^"]*\/unsubscribe[^"]*)"/i);
  if (!match?.[1]) return null;
  return match[1].replaceAll("&amp;", "&");
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

/** Approves pending messages and releases them to the queue. */
export async function approveMessages(
  messageIds: string[],
  approvedById: string,
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const collection = await emailMessages();
  const now = new Date();

  const pending = await collection
    .find({ messageId: { $in: messageIds }, status: "pending_approval" })
    .toArray();

  if (pending.length === 0) return 0;

  await collection.updateMany(
    { messageId: { $in: pending.map((message) => message.messageId) } },
    {
      $set: {
        status: "queued",
        approvedById,
        approvedAt: now,
        updatedAt: now,
      },
    },
  );

  // Spaced out rather than all at once: a burst of identical messages hitting
  // one provider in the same second is the clearest spam signal there is.
  const { nextSendDelayMs } = await import("@/lib/email/compliance");
  await Promise.all(
    pending.map((message, index) =>
      enqueueJob({
        type: JOB_TYPES.emailSend,
        payload: { messageId: message.messageId, track: true },
        runAt: new Date(now.getTime() + nextSendDelayMs(index)),
        idempotencyKey: `email:${message.messageId}`,
      }),
    ),
  );

  return pending.length;
}

export async function cancelMessages(messageIds: string[]): Promise<number> {
  if (messageIds.length === 0) return 0;
  const collection = await emailMessages();
  const result = await collection.updateMany(
    {
      messageId: { $in: messageIds },
      status: { $in: ["draft", "pending_approval", "queued"] },
    },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );
  return result.modifiedCount;
}
