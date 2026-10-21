import "server-only";

import { getSettingsFresh } from "@/lib/server/settings";
import { getSiteUrl } from "@/lib/server/env";
import {
  expireStaleProposals,
  listDueProposalReminders,
  PROPOSAL_REMINDER_AFTER_DAYS,
  recordProposalReminder,
} from "@/lib/server/proposals/repository";
import { formatAmount } from "@/lib/pricing";
import { notify } from "@/lib/server/email/notify";
import type { EmailBlock } from "@/lib/email/template";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * `proposal.followups` — Expires stale proposals and nudges the owner about the
 * ones a client read but did not answer.
 *
 * One notification listing every stalled proposal, not one email per proposal:
 * the owner acts on the list, and a per-proposal email would turn a quiet
 * inbox into a queue. `lastReminderAt` is written for each proposal after the
 * notification is queued, so a second run on the same day finds nothing due.
 */

const RESERVE_MS = 5_000;

export async function handleProposalFollowups(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.proposalFollowups) {
    context.log("Proposal follow-ups are switched off.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const expired = await expireStaleProposals(now);
  if (expired > 0) {
    context.log(`Expired ${expired} stale proposal(s).`);
  }

  const due = await listDueProposalReminders(now);
  if (due.length === 0) {
    context.log("No proposals are awaiting a follow-up.");
    return { expired, reminders: 0 };
  }

  if (Date.now() > context.deadline - RESERVE_MS) {
    context.log(
      `Skipping ${due.length} reminder(s): the run is out of time budget.`,
    );
    return { expired, reminders: 0, deferred: due.length };
  }

  const items = due.map((proposal) => {
    const viewedAt = proposal.viewedAt ?? proposal.sentAt;
    const days = viewedAt
      ? Math.max(
          PROPOSAL_REMINDER_AFTER_DAYS,
          Math.floor((now.getTime() - viewedAt.getTime()) / 86_400_000),
        )
      : PROPOSAL_REMINDER_AFTER_DAYS;
    return `${proposal.company || proposal.clientName || proposal.proposalId} — "${proposal.title}" (${formatAmount(proposal.total, proposal.currency)}), read ${days} day(s) ago.`;
  });

  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `${due.length} proposal(s) were viewed but not answered. A short, specific follow-up is usually what moves these.`,
    },
    { type: "ul", items },
    {
      type: "cta",
      label: "Open proposals",
      url: `${getSiteUrl()}/admin/proposals?status=viewed`,
    },
  ];

  let delivered = 0;
  try {
    const result = await notify({
      channel: "formSubmission",
      subject: `${due.length} proposal(s) need a follow-up`,
      blocks,
      subjectId: `proposal-followups-${now.toISOString().slice(0, 10)}`,
    });
    delivered = result.sent.length;
    if (delivered === 0) {
      // Disabled, no recipients, or a failed queue: in every case nothing was
      // delivered, so `lastReminderAt` must stay untouched and the next run
      // retries. Marking them here would hide the proposals for a week.
      context.log(
        `Follow-up notification was not delivered (${result.skipped ?? "unknown"}).`,
      );
      return { expired, reminders: 0, failed: due.length };
    }
  } catch (error) {
    context.log(
      `Follow-up notification failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return { expired, reminders: 0, failed: due.length };
  }

  for (const proposal of due) {
    await recordProposalReminder(proposal.proposalId, now);
  }
  context.log(
    `Queued a follow-up reminder for ${due.length} proposal(s) to ${delivered} recipient(s).`,
  );

  return { expired, reminders: due.length };
}
