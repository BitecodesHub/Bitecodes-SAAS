import "server-only";

import { headers } from "next/headers";
import { auditLogEntries } from "@/lib/server/db/collections";
import { hashIp } from "@/lib/server/crypto";

/**
 * The admin audit log.
 *
 * Records who did what. This matters more than usual here because the panel
 * takes actions with outside consequences — sending mail to real businesses,
 * publishing pages to the live site, changing the sending caps — and after the
 * fact "who approved that campaign" needs an answer.
 *
 * Writes never throw. An audit write that fails must not roll back the action it
 * describes: losing one log line is a lesser problem than a half-applied
 * mutation. Failures are logged to the server console instead.
 */

export const AUDIT_ACTIONS = {
  loginSucceeded: "auth.login.succeeded",
  loginFailed: "auth.login.failed",
  loginLocked: "auth.login.locked",
  logout: "auth.logout",
  passwordChanged: "auth.password.changed",
  passwordResetRequested: "auth.password.reset_requested",
  loginLinkRequested: "auth.login_link.requested",
  loginLinkUsed: "auth.login_link.used",
  signupStarted: "auth.signup.started",
  signupVerified: "auth.signup.verified",
  twoFactorEnabled: "auth.2fa.enabled",
  twoFactorDisabled: "auth.2fa.disabled",
  sessionRevoked: "auth.session.revoked",

  settingsUpdated: "settings.updated",

  leadStatusChanged: "lead.status.changed",
  leadNoteAdded: "lead.note.added",
  leadAssigned: "lead.assigned",
  leadReplied: "lead.replied",

  prospectDiscoveryStarted: "prospect.discovery.started",
  prospectsImported: "prospect.imported",
  prospectsTagged: "prospect.tagged",
  prospectStatusChanged: "prospect.status.changed",
  prospectsSuppressed: "prospect.suppressed",

  emailApproved: "email.approved",
  emailCancelled: "email.cancelled",
  emailTemplateUpdated: "email.template.updated",
  emailTestSent: "email.test.sent",
  sequenceEnrolled: "email.sequence.enrolled",
  suppressionAdded: "email.suppression.added",
  suppressionRemoved: "email.suppression.removed",

  postCreated: "blog.post.created",
  postUpdated: "blog.post.updated",
  postPublished: "blog.post.published",
  postUnpublished: "blog.post.unpublished",
  postDeleted: "blog.post.deleted",
  aiDraftGenerated: "blog.ai.draft",

  jobRetried: "job.retried",
  jobCancelled: "job.cancelled",

  userInvited: "user.invited",
  userRoleChanged: "user.role.changed",
  userDisabled: "user.disabled",
  userEnabled: "user.enabled",

  chatKnowledgeUpdated: "chat.knowledge.updated",

  chatbotCreated: "chatbot.created",
  chatbotUpdated: "chatbot.updated",
  chatbotDeleted: "chatbot.deleted",
  chatbotApiKeyCreated: "chatbot.apikey.created",
  chatbotApiKeyRevoked: "chatbot.apikey.revoked",
  chatbotModelUpdated: "chatbot.model.updated",

  formCreated: "form.created",
  formUpdated: "form.updated",
  formDeleted: "form.deleted",
  formSubmissionStatusChanged: "form.submission.status_changed",

  bookingCreated: "booking.created",
  bookingUpdated: "booking.updated",
  bookingDeleted: "booking.deleted",
  /** One appointment cancelled, not the configuration it was booked against. */
  bookingCancelled: "booking.cancelled",

  billingOrderCreated: "billing.order.created",
  billingWebhookProcessed: "billing.webhook.processed",
  billingCreditsGranted: "billing.credits.granted",
  chatResolved: "chat.resolved",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntryInput {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  target?: { type: string; id: string } | null;
  detail?: Record<string, unknown> | null;
}

export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  try {
    const collection = await auditLogEntries();
    await collection.insertOne({
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ? redact(entry.detail) : null,
      ipHash: hashIp(await readClientIp()),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error(
      "[audit] Failed to record entry:",
      entry.action,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Strips anything that looks like a credential before it is persisted.
 *
 * The log is read by people and exported; a detail payload assembled from form
 * data should never carry a password or token into it. Belt-and-braces against
 * a careless caller passing a whole `FormData` object.
 */
const SENSITIVE_KEYS =
  /pass|secret|token|totp|hash|authorization|cookie|credential|apikey|api_key/i;

function redact(detail: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEYS.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    // Bound long strings so one oversized field cannot bloat the collection.
    output[key] =
      typeof value === "string" && value.length > 500
        ? `${value.slice(0, 500)}…`
        : value;
  }

  return output;
}

async function readClientIp(): Promise<string | null> {
  try {
    const headerList = await headers();
    return (
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerList.get("x-real-ip") ||
      null
    );
  } catch {
    // Outside a request scope (a script or a job), there is no client IP.
    return null;
  }
}

export async function listAuditEntries(limit = 50, skip = 0) {
  const collection = await auditLogEntries();
  return collection
    .find({}, { sort: { createdAt: -1 }, limit, skip })
    .toArray();
}

export async function countAuditEntries() {
  const collection = await auditLogEntries();
  return collection.estimatedDocumentCount();
}
