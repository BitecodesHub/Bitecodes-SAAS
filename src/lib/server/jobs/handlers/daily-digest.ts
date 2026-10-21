import "server-only";

import { getServerEnv } from "@/lib/server/env";
import { queueEmail } from "@/lib/server/email/send";
import { getSettingsFresh } from "@/lib/server/settings";
import type { EmailBlock } from "@/lib/email/template";
import type { JobContext } from "@/lib/server/jobs/worker";
import { collectDigestSections } from "@/lib/server/digest/collect";
import { jobs } from "@/lib/server/db/collections";

/**
 * The owner's daily report — every growth section for the last 24 hours,
 * plus dead-lettered jobs and AI fallback stats.
 *
 * Does not gate individual sections behind `settings.growth` toggles: the
 * digest collects what the automations have done, and reporting a disabled
 * section as empty is more useful than silently omitting it. The toggle
 * controls the automation, not the reporting.
 */
export async function handleDailyDigest(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const env = getServerEnv();
  const settings = await getSettingsFresh();

  const now = new Date();
  const to = new Date(now);
  // Align to start of the current hour for a clean 24-hour window.
  to.setUTCMinutes(0, 0, 0);
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

  const range = { from, to };

  // Collect all digest sections in parallel (each has its own timeout).
  const sections = await collectDigestSections(range, {
    onError: (id, message) =>
      context.log(`[digest] Section "${id}" skipped: ${message}`),
  });

  // Fetch failed / dead-lettered jobs in the last 24 hours.
  let failedJobCount = 0;
  let deadJobCount = 0;
  const failedJobTypes: string[] = [];
  try {
    const collection = await jobs();
    const [failedDocs, dead] = await Promise.all([
      collection
        .find({ status: "failed", updatedAt: { $gte: from } })
        .project({ type: 1 })
        .toArray(),
      collection.countDocuments({
        status: "failed",
        attempts: { $gte: 5 },
        updatedAt: { $gte: from },
      }),
    ]);
    failedJobCount = failedDocs.length;
    deadJobCount = dead;
    for (const doc of failedDocs.slice(0, 10)) {
      const t = (doc as { type?: string }).type;
      if (t && !failedJobTypes.includes(t)) failedJobTypes.push(t);
    }
  } catch (error) {
    context.log(
      `[digest] Could not read job stats: ${error instanceof Error ? error.message : error}`,
    );
  }

  // Fetch AI automation run stats for the period.
  let aiRuns = 0;
  let aiFailures = 0;
  try {
    const { aiAutomationRuns } = await import("@/lib/server/db/collections");
    const col = await aiAutomationRuns();
    const [runs, failures] = await Promise.all([
      col.countDocuments({ createdAt: { $gte: from, $lt: to } }),
      col.countDocuments({ createdAt: { $gte: from, $lt: to }, ok: false }),
    ]);
    aiRuns = runs;
    aiFailures = failures;
  } catch (error) {
    context.log(
      `[digest] Could not read AI run stats: ${error instanceof Error ? error.message : error}`,
    );
  }

  // Build the email body.
  const dateLabel = from.toISOString().slice(0, 10);
  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `Owner daily digest — ${dateLabel} UTC.`,
    },
  ];

  if (sections.length === 0) {
    blocks.push({
      type: "p",
      text: "Nothing to report for this period. All sections returned empty or timed out.",
    });
  } else {
    for (const section of sections) {
      blocks.push({ type: "h2", text: section.title });
      blocks.push({ type: "p", text: section.summary });
      if (section.metrics.length > 0) {
        blocks.push({
          type: "ul",
          items: section.metrics.map((m) =>
            m.change
              ? `${m.label}: ${m.value} (${m.change})`
              : `${m.label}: ${m.value}`,
          ),
        });
      }
      // Include any inline blocks the section provides (top pages, etc.)
      for (const block of section.blocks) {
        // Skip duplicates of summary lines already rendered above.
        if (
          block.type !== "p" ||
          (block as { text?: string }).text !== section.summary
        ) {
          blocks.push(block);
        }
      }
    }
  }

  // Operations section: job health + AI stats.
  blocks.push({ type: "h2", text: "Operations" });
  const opsItems: string[] = [
    `AI automation calls: ${aiRuns} (${aiFailures} failure${aiFailures === 1 ? "" : "s"}).`,
    `Jobs failed in last 24 h: ${failedJobCount} (${deadJobCount} dead-lettered).`,
  ];
  if (failedJobTypes.length > 0) {
    opsItems.push(`Affected types: ${failedJobTypes.join(", ")}.`);
  }
  blocks.push({ type: "ul", items: opsItems });

  // Resolve recipients: notification settings → fallback to CONTACT_NOTIFICATION_TO.
  const notifRecipients =
    settings.notifications.channels.failedJob.recipients.length > 0
      ? settings.notifications.channels.failedJob.recipients
      : settings.notifications.defaultRecipients.length > 0
        ? settings.notifications.defaultRecipients
        : env.CONTACT_NOTIFICATION_TO;

  if (notifRecipients.length === 0) {
    context.log("[digest] No recipients configured — digest not sent.");
    return { sections: sections.length, recipients: 0 };
  }

  const subject = `Daily digest — ${dateLabel}: ${sections.length} section${sections.length === 1 ? "" : "s"}${failedJobCount > 0 ? `, ${failedJobCount} job failure${failedJobCount === 1 ? "" : "s"}` : ""}`;

  const results = await Promise.allSettled(
    notifRecipients.map((recipient) =>
      queueEmail({
        to: recipient,
        subject,
        blocks,
        category: "internal",
        skipApproval: true,
        track: false,
      }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) =>
      r.status === "rejected"
        ? r.reason instanceof Error
          ? r.reason.message
          : String(r.reason)
        : "",
    );

  for (const err of errors) {
    context.log(`[digest] Send error: ${err}`);
  }

  context.log(
    `Digest sent to ${sent}/${notifRecipients.length} recipient(s). Sections: ${sections.length}. AI: ${aiRuns} runs, ${aiFailures} failures.`,
  );

  return {
    sections: sections.length,
    recipients: sent,
    aiRuns,
    aiFailures,
    failedJobCount,
    deadJobCount,
  };
}
