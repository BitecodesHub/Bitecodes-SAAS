import "server-only";

import { getServerEnv, getSiteUrl } from "@/lib/server/env";
import { getProspectStats } from "@/lib/server/prospecting/repository";
import { listPendingApproval } from "@/lib/server/email/inbox";
import { countSentToday, queueEmail } from "@/lib/server/email/send";
import {
  emailMessages,
  prospects,
  sequenceEnrollments,
} from "@/lib/server/db/collections";
import { getSettingsFresh } from "@/lib/server/settings";
import type { EmailBlock } from "@/lib/email/template";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * The owner's daily report — what a human assistant would leave on the desk.
 *
 * One email, once a day: what the autopilot found, wrote, and heard back,
 * plus the one thing that genuinely needs a human (the held consent-region
 * batch). Sent to the transactional notification addresses, never tracked.
 */
export async function handleDailyDigest(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const env = getServerEnv();
  const settings = await getSettingsFresh();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const prospectCollection = await prospects();
  const enrollments = await sequenceEnrollments();
  const messages = await emailMessages();

  const [
    stats,
    sentToday,
    pending,
    discoveredToday,
    enrolledToday,
    repliedToday,
    failedToday,
  ] = await Promise.all([
    getProspectStats(),
    countSentToday(null),
    listPendingApproval(200),
    prospectCollection.countDocuments({ createdAt: { $gte: dayStart } }),
    enrollments.countDocuments({ createdAt: { $gte: dayStart } }),
    prospectCollection.countDocuments({
      status: "replied",
      updatedAt: { $gte: dayStart },
    }),
    messages.countDocuments({ failedAt: { $gte: dayStart } }),
  ]);

  const adminUrl = `${getSiteUrl()}/admin`;
  const heldCount = pending.length;

  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `Daily summary for ${now.toISOString().slice(0, 10)} (UTC).`,
    },
    { type: "h2", text: "Pipeline" },
    {
      type: "ul",
      items: [
        `${discoveredToday} new prospect(s) discovered today — ${stats.total} total, ${stats.withEmail} with an email address.`,
        `${enrolledToday} prospect(s) entered an outreach sequence today.`,
        `${sentToday} email(s) sent today (cap ${settings.automation.globalDailyCap}).`,
        `${repliedToday} repl${repliedToday === 1 ? "y" : "ies"} detected today.`,
        `${failedToday} send failure(s) today.`,
      ],
    },
  ];

  if (heldCount > 0) {
    blocks.push(
      { type: "h2", text: "Needs you" },
      {
        type: "p",
        text: `${heldCount} message(s) are waiting for your release — most from consent-required regions (UK/EU/AU/CA), where a human must approve each batch.`,
      },
      { type: "cta", label: "Review and release", url: `${adminUrl}/email` },
    );
  } else {
    blocks.push({
      type: "p",
      text: "Nothing is waiting on you today.",
    });
  }

  blocks.push({
    type: "p",
    text: `Pipeline stages: ${Object.entries(stats.byStatus)
      .map(([status, count]) => `${status} ${count}`)
      .join(" · ")}.`,
  });

  const results = await Promise.all(
    env.CONTACT_NOTIFICATION_TO.map((to) =>
      queueEmail({
        to,
        subject: `Bitecodes daily digest — ${discoveredToday} found, ${sentToday} sent, ${heldCount} waiting`,
        blocks,
        category: "internal",
        skipApproval: true,
        track: false,
      }),
    ),
  );

  context.log(
    `Digest queued to ${results.length} recipient(s); ${heldCount} message(s) held.`,
  );
  return { recipients: results.length, heldCount, sentToday, discoveredToday };
}
