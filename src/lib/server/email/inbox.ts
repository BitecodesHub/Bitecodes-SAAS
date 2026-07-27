import "server-only";

import type { Filter } from "mongodb";
import { emailMessages } from "@/lib/server/db/collections";
import type {
  EmailMessageDoc,
  EmailMessageStatus,
} from "@/lib/server/db/types";

/**
 * Reads over the email outbox, for the admin panel.
 *
 * Kept apart from `send.ts`, which owns the write path. That file decides whether
 * a message may exist at all — suppression, caps, the approval gate — and mixing
 * list queries into it would blur a boundary worth keeping sharp.
 *
 * Every projection here excludes `html`. A sent log holding several hundred
 * rendered emails is megabytes of markup nobody is reading in a table, and
 * shipping it to the browser for a list view would be careless.
 */

export const EMAIL_PAGE_SIZE = 25;

/** Summary row for the outbox table. */
export interface EmailMessageSummary {
  messageId: string;
  to: string;
  toName: string | null;
  subject: string;
  status: EmailMessageStatus;
  category: EmailMessageDoc["category"];
  templateKey: string | null;
  skipReason: string | null;
  prospectId: string | null;
  sendAfter: Date;
  sentAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  attempts: number;
  openCount: number;
  clickCount: number;
  createdAt: Date;
}

export interface EmailQuery {
  status?: EmailMessageStatus | "all";
  category?: EmailMessageDoc["category"] | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface EmailPage {
  items: EmailMessageSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(query: EmailQuery): Filter<EmailMessageDoc> {
  const filter: Filter<EmailMessageDoc> = {};

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.category && query.category !== "all") {
    filter.category = query.category;
  }

  const term = query.search?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegExp(term), "i");
    filter.$or = [
      { to: pattern },
      { toName: pattern },
      { subject: pattern },
      { templateKey: pattern },
    ];
  }

  return filter;
}

function toSummary(document: EmailMessageDoc): EmailMessageSummary {
  return {
    messageId: document.messageId,
    to: document.to,
    toName: document.toName,
    subject: document.subject,
    status: document.status,
    category: document.category,
    templateKey: document.templateKey,
    skipReason: document.skipReason,
    prospectId: document.prospectId,
    sendAfter: document.sendAfter,
    sentAt: document.sentAt,
    failedAt: document.failedAt,
    lastError: document.lastError,
    attempts: document.attempts,
    openCount: document.opens?.length ?? 0,
    clickCount: document.clicks?.length ?? 0,
    createdAt: document.createdAt,
  };
}

export async function listEmailMessages(
  query: EmailQuery = {},
): Promise<EmailPage> {
  const collection = await emailMessages();
  const filter = buildFilter(query);

  const pageSize = Math.min(
    100,
    Math.max(1, Math.round(query.pageSize ?? EMAIL_PAGE_SIZE)),
  );
  const requestedPage = Math.max(1, Math.round(query.page ?? 1));

  const total = await collection.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const rows = await collection
    .find(filter, {
      // `html` and `text` are deliberately excluded — see the module comment.
      projection: { html: 0, text: 0 },
    })
    // Newest first by creation, not by `sentAt`: a queued or failed message has
    // no `sentAt` and would otherwise sort to the bottom, which is exactly where
    // an operator does not want to hunt for the thing that went wrong.
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return {
    items: rows.map(toSummary),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/** One message with its rendered body, for the preview drawer. */
export async function getEmailMessage(
  messageId: string,
): Promise<EmailMessageDoc | null> {
  const collection = await emailMessages();
  return collection.findOne({ messageId });
}

export interface EmailStats {
  total: number;
  byStatus: Record<string, number>;
  awaitingApproval: number;
  sentLast7Days: number;
  opened: number;
  clicked: number;
}

export async function getEmailStats(now = new Date()): Promise<EmailStats> {
  const collection = await emailMessages();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [byStatusRows, total, sentLast7Days, opened, clicked] =
    await Promise.all([
      collection
        .aggregate<{
          _id: EmailMessageStatus;
          count: number;
        }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
      collection.countDocuments({}),
      collection.countDocuments({ status: "sent", sentAt: { $gte: weekAgo } }),
      // `$ne: []` rather than `$exists` — the field is always written as an
      // array, so "has any" is the question, not "is present".
      collection.countDocuments({ opens: { $ne: [] } }),
      collection.countDocuments({ clicks: { $ne: [] } }),
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) byStatus[row._id] = row.count;

  return {
    total,
    byStatus,
    awaitingApproval: byStatus.pending_approval ?? 0,
    sentLast7Days,
    opened,
    clicked,
  };
}

/**
 * The approval queue, oldest first.
 *
 * Oldest first on purpose: this is a work queue, and the message that has been
 * waiting longest is the one whose timing is most at risk of going stale.
 */
export async function listPendingApproval(
  limit = 100,
): Promise<EmailMessageSummary[]> {
  const collection = await emailMessages();
  const rows = await collection
    .find({ status: "pending_approval" }, { projection: { html: 0, text: 0 } })
    .sort({ createdAt: 1 })
    .limit(Math.min(500, Math.max(1, limit)))
    .toArray();

  return rows.map(toSummary);
}
