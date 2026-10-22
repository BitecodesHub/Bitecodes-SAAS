import "server-only";

import { getServerEnv } from "@/lib/server/env";
import { queueEmail } from "@/lib/server/email/send";
import { getSettingsFresh, recipientsForChannel } from "@/lib/server/settings";
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

  // Collect all digest sections in parallel (each has its own timeout). A
  // section that fails is recorded here rather than reported as an empty one:
  // "0 leads" from a failed query is worse than no section at all, because it
  // reads like a good day.
  const sectionFailures: Array<{ id: string; message: string }> = [];
  const sections = await collectDigestSections(range, {
    onError: (id, message) => {
      sectionFailures.push({ id, message });
      context.log(`[digest] Section "${id}" skipped: ${message}`);
    },
  });

  // Fetch failed / dead-lettered jobs in the last 24 hours.
  let jobStats: {
    failed: number;
    dead: number;
    types: string[];
  } | null = null;
  let jobStatsError: string | null = null;
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
    const types: string[] = [];
    for (const doc of failedDocs.slice(0, 10)) {
      const t = (doc as { type?: string }).type;
      if (t && !types.includes(t)) types.push(t);
    }
    jobStats = { failed: failedDocs.length, dead, types };
  } catch (error) {
    jobStatsError = error instanceof Error ? error.message : String(error);
    context.log(`[digest] Could not read job stats: ${jobStatsError}`);
  }

  // Fetch AI automation run stats for the period.
  let aiStats: { runs: number; failures: number } | null = null;
  let aiStatsError: string | null = null;
  try {
    const { aiAutomationRuns } = await import("@/lib/server/db/collections");
    const col = await aiAutomationRuns();
    const [runs, failures] = await Promise.all([
      col.countDocuments({ createdAt: { $gte: from, $lt: to } }),
      col.countDocuments({ createdAt: { $gte: from, $lt: to }, ok: false }),
    ]);
    aiStats = { runs, failures };
  } catch (error) {
    aiStatsError = error instanceof Error ? error.message : String(error);
    context.log(`[digest] Could not read AI run stats: ${aiStatsError}`);
  }

  // Build the email body. The full window is stated, with its timezone, so any
  // figure can be reconciled against a query on the same range.
  const fromLabel = from.toISOString().slice(0, 16).replace("T", " ");
  const toLabel = to.toISOString().slice(0, 16).replace("T", " ");
  const dateLabel = `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`;
  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `Owner daily digest — ${fromLabel} to ${toLabel} UTC.`,
    },
  ];

  if (sections.length === 0) {
    blocks.push({
      type: "p",
      text:
        sectionFailures.length > 0
          ? "No section could be built for this period; the failures are listed below."
          : "No section had anything to report for this period.",
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

  // A source query that failed must not be reported as a zero.
  if (sectionFailures.length > 0) {
    blocks.push({ type: "h2", text: "Reporting gaps" });
    blocks.push({
      type: "p",
      text: `${sectionFailures.length} section${sectionFailures.length === 1 ? "" : "s"} could not be built for this period. The figures they would have contributed are unknown, not zero.`,
    });
    blocks.push({
      type: "ul",
      items: sectionFailures.map(
        (failure) => `${failure.id}: ${failure.message}`,
      ),
    });
  }

  // Operations section: job health + AI stats.
  blocks.push({ type: "h2", text: "Operations" });
  const opsItems: string[] = [];
  opsItems.push(
    aiStats
      ? `AI automation calls: ${aiStats.runs} (${aiStats.failures} failure${aiStats.failures === 1 ? "" : "s"}).`
      : `AI automation calls: unavailable (${aiStatsError}).`,
  );
  if (jobStats) {
    opsItems.push(
      `Jobs failed in last 24 h: ${jobStats.failed} (${jobStats.dead} dead-lettered).`,
    );
    if (jobStats.types.length > 0) {
      opsItems.push(`Affected types: ${jobStats.types.join(", ")}.`);
    }
  } else {
    opsItems.push(`Job failures: unavailable (${jobStatsError}).`);
  }
  blocks.push({ type: "ul", items: opsItems });

  // Owner reports have their own channel: a digest is not a failed-job alert,
  // and routing it through that channel meant customising failure recipients
  // silently changed who received the daily report.
  const configuredRecipients = recipientsForChannel(settings, "ownerReports");
  const notifRecipients =
    configuredRecipients.length > 0
      ? configuredRecipients
      : settings.notifications.channels.ownerReports.enabled
        ? env.CONTACT_NOTIFICATION_TO
        : [];

  if (notifRecipients.length === 0) {
    context.log("[digest] No recipients configured — digest not sent.");
    return {
      sections: sections.length,
      sectionFailures: sectionFailures.length,
      recipients: 0,
    };
  }

  const failedJobsLabel = jobStats
    ? jobStats.failed > 0
      ? `, ${jobStats.failed} job failure${jobStats.failed === 1 ? "" : "s"}`
      : ""
    : ", job stats unavailable";
  const subject = `Daily digest — ${dateLabel}: ${sections.length} section${sections.length === 1 ? "" : "s"}${sectionFailures.length > 0 ? `, ${sectionFailures.length} reporting gap${sectionFailures.length === 1 ? "" : "s"}` : ""}${failedJobsLabel}`;

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

  // A gate-refused or undeliverable message is not a sent digest, even though
  // `queueEmail` resolved. Counting fulfilled promises reported success for
  // mail that was explicitly skipped.
  let sent = 0;
  let skipped = 0;
  for (const result of results) {
    if (
      result.status === "fulfilled" &&
      (result.value.status === "queued" ||
        result.value.status === "pending_approval")
    ) {
      sent += 1;
      continue;
    }
    if (result.status === "fulfilled") {
      skipped += 1;
      context.log(
        `[digest] Recipient refused by the email gate: ${result.value.skipReason ?? result.value.status}.`,
      );
    } else {
      context.log(
        `[digest] Send error: ${
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        }`,
      );
    }
  }

  context.log(
    `Digest queued for ${sent}/${notifRecipients.length} recipient(s) (${skipped} refused). Sections: ${sections.length}, gaps: ${sectionFailures.length}. AI: ${aiStats ? `${aiStats.runs} runs, ${aiStats.failures} failures` : "unavailable"}.`,
  );

  return {
    sections: sections.length,
    sectionFailures: sectionFailures.length,
    recipients: sent,
    refused: skipped,
    aiRuns: aiStats?.runs ?? null,
    aiFailures: aiStats?.failures ?? null,
    failedJobCount: jobStats?.failed ?? null,
    deadJobCount: jobStats?.dead ?? null,
  };
}
