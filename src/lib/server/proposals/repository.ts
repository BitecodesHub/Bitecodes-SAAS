import "server-only";

import { randomUUID } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";
import { proposals } from "@/lib/server/db/collections";
import type {
  ProposalDoc,
  ProposalLeadRef,
  ProposalStatus,
} from "@/lib/server/db/types";
import { hmacHex, sha256Hex } from "@/lib/server/crypto";
import { getSiteUrl } from "@/lib/server/env";
import {
  formatProposalLeadRef,
  parseProposalLeadRef,
  PROPOSAL_PAGE_SIZE,
  PROPOSAL_STATUSES,
} from "@/lib/proposals/display";
import type { CurrencyCode } from "@/lib/pricing";
import type {
  BuiltProposalLine,
  BuiltProposalPaymentTerm,
  BuiltProposalRetainerUpsell,
} from "@/lib/proposals/pricing";
import { setLeadStatus } from "@/lib/server/leads/repository";

/**
 * The proposals repository.
 *
 * Three invariants hold here rather than in the caller:
 *
 *  1. **The public token is never stored.** A proposal's link is derived from
 *     its id with a keyed hash, and only `sha256(token)` is persisted. A leaked
 *     database therefore cannot be turned into working proposal links, and the
 *     admin can still re-derive the link later for sending and copying.
 *  2. **Status changes are atomic and conditional.** Acceptance is a guarded
 *     `findOneAndUpdate` on `sent`/`viewed`, so a double click cannot produce
 *     two acceptance records, and a draft or expired proposal cannot be
 *     accepted at all.
 *  3. **Expiry is lazy as well as scheduled.** The daily job expires proposals,
 *     but the public page and the accept action check the date themselves; a
 *     proposal must not stay acceptable just because the job has not run yet.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const PROPOSAL_REMINDER_AFTER_DAYS = 3;
export const PROPOSAL_REMINDER_REPEAT_DAYS = 7;

/**
 * Deterministic, unguessable token for a proposal.
 *
 * Keyed with AUTH_SECRET, so the link cannot be computed by anyone who merely
 * knows a proposal id. The fallback keeps the application usable when the
 * secret is missing (for example in a read-only development environment); the
 * id itself still carries 64 random bits, so the fallback remains infeasible
 * to enumerate.
 */
export function deriveProposalToken(proposalId: string): string {
  try {
    return hmacHex(`proposal-link:${proposalId}`);
  } catch {
    return sha256Hex(`proposal-link:${proposalId}`);
  }
}

export function proposalTokenHash(proposalId: string): string {
  return sha256Hex(deriveProposalToken(proposalId));
}

/** Path containing the public token. Use `proposalPublicUrl` inside email. */
export function proposalPublicPath(proposalId: string): string {
  return `/proposal/${deriveProposalToken(proposalId)}`;
}

export function proposalPublicUrl(proposalId: string): string {
  return `${getSiteUrl()}${proposalPublicPath(proposalId)}`;
}

function newProposalId(now = new Date()): string {
  // 16 hex characters from a UUID carry 64 random bits, so ids do not collide
  // and the human-readable reference is still short enough to quote.
  const random = randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
  return `PROP-${now.getUTCFullYear()}-${random}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProposalQuery {
  status?: ProposalStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ProposalPage {
  items: ProposalDoc[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProposalStats {
  total: number;
  byStatus: Record<ProposalStatus, number>;
  /** Sent or viewed, not yet accepted, declined, or expired. */
  openValueByCurrency: Partial<Record<CurrencyCode, number>>;
  acceptedValueByCurrency: Partial<Record<CurrencyCode, number>>;
}

/** One page of the proposal list, newest activity first. */
export async function listProposals(
  query: ProposalQuery = {},
): Promise<ProposalPage> {
  const collection = await proposals();
  const pageSize = Math.min(
    100,
    Math.max(1, Math.round(query.pageSize ?? PROPOSAL_PAGE_SIZE)),
  );
  const requestedPage = Math.max(1, Math.round(query.page ?? 1));

  const filter: Filter<ProposalDoc> = {};
  if (query.status && query.status !== "all") filter.status = query.status;

  const term = query.search?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegExp(term), "i");
    filter.$or = [
      { proposalId: pattern },
      { clientName: pattern },
      { clientEmail: pattern },
      { company: pattern },
      { title: pattern },
    ];
  }

  const [rows, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((requestedPage - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (requestedPage > totalPages && total > 0) {
    return listProposals({ ...query, page: totalPages, pageSize });
  }

  return {
    items: rows,
    total,
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalPages,
  };
}

/** Status totals and open/accepted value, used by the list header. */
export async function getProposalStats(): Promise<ProposalStats> {
  const collection = await proposals();
  const rows = await collection
    .aggregate<{
      _id: { status: ProposalStatus; currency: CurrencyCode };
      count: number;
      value: number;
    }>([
      {
        $group: {
          _id: { status: "$status", currency: "$currency" },
          count: { $sum: 1 },
          value: { $sum: "$total" },
        },
      },
    ])
    .toArray();

  const byStatus = Object.fromEntries(
    PROPOSAL_STATUSES.map((status) => [status, 0]),
  ) as Record<ProposalStatus, number>;
  const openValueByCurrency: Partial<Record<CurrencyCode, number>> = {};
  const acceptedValueByCurrency: Partial<Record<CurrencyCode, number>> = {};
  let total = 0;

  for (const row of rows) {
    total += row.count;
    byStatus[row._id.status] += row.count;
    if (row._id.status === "sent" || row._id.status === "viewed") {
      openValueByCurrency[row._id.currency] =
        (openValueByCurrency[row._id.currency] ?? 0) + row.value;
    }
    if (row._id.status === "accepted") {
      acceptedValueByCurrency[row._id.currency] =
        (acceptedValueByCurrency[row._id.currency] ?? 0) + row.value;
    }
  }

  return { total, byStatus, openValueByCurrency, acceptedValueByCurrency };
}

/** Loads by proposal id or Mongo id, so both admin URLs work. */
export async function getProposal(id: string): Promise<ProposalDoc | null> {
  const collection = await proposals();
  if (ObjectId.isValid(id)) {
    const byObjectId = await collection.findOne({ _id: new ObjectId(id) });
    if (byObjectId) return byObjectId;
  }
  return collection.findOne({ proposalId: id });
}

/** Public lookup. An invalid or unknown token is indistinguishable from a miss. */
export async function getProposalByToken(
  token: string,
): Promise<ProposalDoc | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const collection = await proposals();
  return collection.findOne({ tokenHash: sha256Hex(token) });
}

export interface CreateProposalInput {
  leadRef: ProposalLeadRef | null;
  clientName: string;
  clientEmail: string;
  company: string | null;
  title: string;
  summary: string;
  scope: string[];
  deliverables: string[];
  milestones: ProposalDoc["milestones"];
  currency: CurrencyCode;
  lineItems: BuiltProposalLine[];
  total: number;
  retainerUpsell: BuiltProposalRetainerUpsell | null;
  paymentSchedule: BuiltProposalPaymentTerm[];
  assumptions: string[];
  exclusions: string[];
  termsLinks: ProposalDoc["termsLinks"];
  validUntil: Date | null;
  createdById: string | null;
  aiAssisted: boolean;
}

export async function createProposal(
  input: CreateProposalInput,
  now = new Date(),
): Promise<ProposalDoc> {
  const collection = await proposals();
  const proposalId = newProposalId(now);
  const doc: ProposalDoc = {
    ...input,
    proposalId,
    tokenHash: proposalTokenHash(proposalId),
    status: "draft",
    sentAt: null,
    viewedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    lastReminderAt: null,
    acceptedAt: null,
    declinedAt: null,
    acceptance: null,
    decline: null,
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  return doc;
}

export interface UpdateProposalInput extends Omit<
  CreateProposalInput,
  "createdById" | "aiAssisted"
> {
  aiAssisted?: boolean;
}

/**
 * Replaces the editable fields. Refuses once the client has answered: editing
 * an accepted or declined proposal would change the record after agreement.
 */
export async function updateProposal(
  id: string,
  input: UpdateProposalInput,
  now = new Date(),
): Promise<ProposalDoc | null> {
  const collection = await proposals();
  const filter: Filter<ProposalDoc> = ObjectId.isValid(id)
    ? { $or: [{ _id: new ObjectId(id) }, { proposalId: id }] }
    : { proposalId: id };
  const { aiAssisted, ...fields } = input;

  const result = await collection.findOneAndUpdate(
    {
      ...filter,
      status: { $in: ["draft", "sent", "viewed"] },
    },
    {
      $set: {
        ...fields,
        // Spreading an absent key would send `aiAssisted: undefined` to the
        // driver, which can surface as a null overwrite. Only write it when the
        // caller actually decided.
        ...(aiAssisted === undefined ? {} : { aiAssisted }),
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return result ?? null;
}

/**
 * Records one view. The status only moves to `viewed` from `sent`; a second
 * open increments the counter but does not rewrite the first-view timestamp.
 */
export async function recordProposalView(
  proposalId: string,
  now = new Date(),
): Promise<ProposalDoc | null> {
  const collection = await proposals();
  return collection.findOneAndUpdate(
    { proposalId },
    [
      {
        $set: {
          viewCount: { $add: [{ $ifNull: ["$viewCount", 0] }, 1] },
          lastViewedAt: now,
          viewedAt: { $ifNull: ["$viewedAt", now] },
          status: {
            $cond: [
              { $in: ["$status", ["sent", "viewed"]] },
              "viewed",
              "$status",
            ],
          },
          updatedAt: now,
        },
      },
    ],
    { returnDocument: "after" },
  );
}

/**
 * Marks a proposal sent. A resend preserves `viewed` (and the first view time)
 * rather than moving the record backwards.
 */
export async function markProposalSent(
  proposalId: string,
  now = new Date(),
): Promise<ProposalDoc | null> {
  const collection = await proposals();
  return collection.findOneAndUpdate(
    {
      proposalId,
      status: { $in: ["draft", "sent", "viewed"] },
    },
    [
      {
        $set: {
          sentAt: { $ifNull: ["$sentAt", now] },
          status: {
            $cond: [{ $eq: ["$status", "draft"] }, "sent", "$status"],
          },
          updatedAt: now,
        },
      },
    ],
    { returnDocument: "after" },
  );
}

/** Lazily expires a proposal whose validity has passed. */
export async function expireProposalIfStale(
  proposalId: string,
  now = new Date(),
): Promise<boolean> {
  const collection = await proposals();
  const result = await collection.updateOne(
    {
      proposalId,
      status: { $in: ["sent", "viewed"] },
      validUntil: { $ne: null, $lt: now },
    },
    { $set: { status: "expired", updatedAt: now } },
  );
  return result.modifiedCount > 0;
}

/** Scheduled expiry for the daily job. Returns the number changed. */
export async function expireStaleProposals(now = new Date()): Promise<number> {
  const collection = await proposals();
  const result = await collection.updateMany(
    {
      status: { $in: ["sent", "viewed"] },
      validUntil: { $ne: null, $lt: now },
    },
    { $set: { status: "expired", updatedAt: now } },
  );
  return result.modifiedCount;
}

export type ProposalTransitionResult =
  | { ok: true; proposal: ProposalDoc }
  | { ok: false; reason: "not-found" | "not-open" | "expired" };

export interface AcceptanceInput {
  name: string;
  title: string;
  signature: string;
  ipHash: string | null;
}

/**
 * Accepts a proposal for a token holder.
 *
 * The filter is the authorisation: only a sent or viewed proposal can move to
 * accepted, and expiry is written first so a stale link cannot slip through
 * between the read and the write.
 */
export async function acceptProposal(
  token: string,
  input: AcceptanceInput,
  now = new Date(),
): Promise<ProposalTransitionResult> {
  const proposal = await getProposalByToken(token);
  if (!proposal) return { ok: false, reason: "not-found" };
  if (await expireProposalIfStale(proposal.proposalId, now)) {
    return { ok: false, reason: "expired" };
  }

  const collection = await proposals();
  const updated = await collection.findOneAndUpdate(
    {
      proposalId: proposal.proposalId,
      status: { $in: ["sent", "viewed"] },
    },
    {
      $set: {
        status: "accepted",
        acceptedAt: now,
        acceptance: {
          name: input.name,
          title: input.title,
          signature: input.signature,
          acceptedAt: now,
          ipHash: input.ipHash,
        },
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return updated
    ? { ok: true, proposal: updated }
    : { ok: false, reason: "not-open" };
}

/** Declines a proposal for a token holder, with a reason. */
export async function declineProposal(
  token: string,
  reason: string,
  ipHash: string | null,
  now = new Date(),
): Promise<ProposalTransitionResult> {
  const proposal = await getProposalByToken(token);
  if (!proposal) return { ok: false, reason: "not-found" };
  if (await expireProposalIfStale(proposal.proposalId, now)) {
    return { ok: false, reason: "expired" };
  }

  const collection = await proposals();
  const updated = await collection.findOneAndUpdate(
    {
      proposalId: proposal.proposalId,
      status: { $in: ["sent", "viewed"] },
    },
    {
      $set: {
        status: "declined",
        declinedAt: now,
        decline: {
          reason,
          declinedAt: now,
          ipHash,
          source: "client",
        },
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return updated
    ? { ok: true, proposal: updated }
    : { ok: false, reason: "not-open" };
}

/** Operator marks the opportunity lost. Same terminal state as a decline. */
export async function markProposalLost(
  proposalId: string,
  reason: string,
  now = new Date(),
): Promise<ProposalDoc | null> {
  const collection = await proposals();
  return collection.findOneAndUpdate(
    {
      proposalId,
      status: { $in: ["draft", "sent", "viewed"] },
    },
    {
      $set: {
        status: "declined",
        declinedAt: now,
        decline: {
          reason,
          declinedAt: now,
          ipHash: null,
          source: "owner",
        },
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
}

/**
 * Viewed but unanswered for at least three days, and not nudged in the last
 * seven. The repeat window is what makes the daily job idempotent: a second run
 * on the same day sees the fresh `lastReminderAt` and skips.
 */
export async function listDueProposalReminders(
  now = new Date(),
  limit = 20,
): Promise<ProposalDoc[]> {
  const collection = await proposals();
  return collection
    .find({
      status: "viewed",
      viewedAt: {
        $lte: new Date(now.getTime() - PROPOSAL_REMINDER_AFTER_DAYS * DAY_MS),
      },
      $or: [
        { lastReminderAt: null },
        {
          lastReminderAt: {
            $lte: new Date(
              now.getTime() - PROPOSAL_REMINDER_REPEAT_DAYS * DAY_MS,
            ),
          },
        },
      ],
    })
    .sort({ viewedAt: 1 })
    .limit(limit)
    .toArray();
}

export async function recordProposalReminder(
  proposalId: string,
  now = new Date(),
): Promise<void> {
  const collection = await proposals();
  await collection.updateOne(
    { proposalId },
    { $set: { lastReminderAt: now, updatedAt: now } },
  );
}

/**
 * Moves the linked lead to `won` after an acceptance.
 *
 * Uses the leads repository's `setLeadStatus`, which is the supported write
 * path for a lead stage; the proposal repository never touches a lead document
 * directly. Returns false when no lead is linked or the id is invalid.
 */
export async function markLinkedLeadWon(
  leadRef: string | null,
): Promise<boolean> {
  const parsed = parseProposalLeadRef(leadRef);
  if (!parsed) return false;
  const changed = await setLeadStatus(parsed.kind, [parsed.id], "won");
  return changed > 0;
}

/** Re-exported so the admin editor can build a lead reference without a split. */
export { formatProposalLeadRef };
