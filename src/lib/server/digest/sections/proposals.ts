import "server-only";

import { proposals } from "@/lib/server/db/collections";
import { PROPOSAL_REMINDER_AFTER_DAYS } from "@/lib/server/proposals/repository";
import { formatAmount, type CurrencyCode } from "@/lib/pricing";
import type {
  DigestMetric,
  DigestRange,
  DigestSection,
} from "@/lib/server/digest/types";
import type { ProposalDoc } from "@/lib/server/db/types";

/**
 * Digest section "proposals": what left the desk, what the client read, and
 * what is waiting on a follow-up.
 *
 * Counts are computed from the timestamps rather than the current status, so a
 * proposal sent yesterday and accepted today appears once in each window it
 * belongs to, and never disappears from history because its status moved on.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

interface AggregateRow {
  _id: { currency: CurrencyCode };
  total: number;
  count: number;
}

export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  const collection = await proposals();
  const now = new Date();
  const overdueBefore = new Date(
    now.getTime() - PROPOSAL_REMINDER_AFTER_DAYS * DAY_MS,
  );

  const [
    sent,
    viewed,
    accepted,
    declined,
    waiting,
    waitingCount,
    acceptedValue,
  ] = await Promise.all([
    collection.countDocuments({
      sentAt: { $gte: range.from, $lt: range.to },
    }),
    collection.countDocuments({
      viewedAt: { $gte: range.from, $lt: range.to },
    }),
    collection.countDocuments({
      acceptedAt: { $gte: range.from, $lt: range.to },
    }),
    collection.countDocuments({
      declinedAt: { $gte: range.from, $lt: range.to },
    }),
    collection
      .find({ status: "viewed", viewedAt: { $lte: overdueBefore } })
      .sort({ viewedAt: 1 })
      .limit(10)
      .toArray(),
    collection.countDocuments({
      status: "viewed",
      viewedAt: { $lte: overdueBefore },
    }),
    collection
      .aggregate<AggregateRow>([
        {
          $match: {
            status: "accepted",
            acceptedAt: { $gte: range.from, $lt: range.to },
          },
        },
        {
          $group: {
            _id: { currency: "$currency" },
            total: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  if (sent === 0 && viewed === 0 && accepted === 0 && waitingCount === 0) {
    return null;
  }

  const acceptedTotals = acceptedValue
    .map((row) => formatAmount(row.total, row._id.currency))
    .join(" · ");

  const metrics: DigestMetric[] = [
    { label: "Sent", value: sent },
    { label: "Viewed", value: viewed },
    { label: "Accepted", value: accepted },
  ];
  if (acceptedTotals) {
    metrics.push({ label: "Accepted value", value: acceptedTotals });
  }
  if (waitingCount > 0) {
    metrics.push({ label: "Awaiting follow-up", value: waitingCount });
  }

  const blocks: DigestSection["blocks"] = [
    {
      type: "p" as const,
      text: `${sent} proposal(s) sent, ${viewed} viewed, ${accepted} accepted${
        declined > 0 ? `, ${declined} declined` : ""
      }.`,
    },
  ];

  if (waiting.length > 0) {
    blocks.push({
      type: "ul",
      items: waiting.map(describeWaiting),
    });
  }

  return {
    id: "proposals",
    title: "Proposals",
    summary: `${sent} sent, ${viewed} viewed, ${accepted} accepted${acceptedTotals ? ` (${acceptedTotals})` : ""}${
      waitingCount > 0 ? `, ${waitingCount} waiting on a follow-up` : ""
    }.`,
    metrics,
    blocks,
    actions:
      waitingCount > 0
        ? [
            {
              label: "Follow up on viewed proposals",
              href: "/admin/proposals?status=viewed",
            },
          ]
        : undefined,
  };
}

function describeWaiting(proposal: ProposalDoc): string {
  const client = proposal.company || proposal.clientName || proposal.proposalId;
  return `${client} read "${proposal.title}" (${formatAmount(
    proposal.total,
    proposal.currency,
  )}) and has not answered.`;
}
