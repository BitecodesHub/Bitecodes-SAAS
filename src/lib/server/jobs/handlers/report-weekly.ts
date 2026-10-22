import "server-only";

import { getAiProviderConfig } from "@/lib/server/ai-provider";
import {
  getSettingsFresh,
  recipientsForChannel,
  type ResolvedSettings,
} from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";
import { getAnalyticsOverview } from "@/lib/server/analytics/repository";
import { countLeadsInRange } from "@/lib/server/leads/repository";
import {
  blogPostDocs,
  emailMessages,
  prospects,
} from "@/lib/server/db/collections";
import { getServerEnv } from "@/lib/server/env";
import { normalizeEmail } from "@/lib/email/address";
import { queueEmail } from "@/lib/server/email/send";
import type { EmailBlock } from "@/lib/email/template";

/**
 * `report.weekly` — The owner's weekly growth report with AI executive summary.
 *
 * Runs on Mondays at 03:00 UTC. When `settings.growth.weeklyReport` is off,
 * returns { skipped: "disabled" }. Otherwise generates an AI‑driven executive
 * summary of the past week's traffic, leads, pipeline, and content, then emails
 * the owner. Stays idempotent: a retry with the same idempotency bucket key
 * produces the same result.
 */

export async function handleWeeklyReport(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.weeklyReport) {
    context.log("Weekly growth report is switched off.");
    return { skipped: "disabled" };
  }

  if (Date.now() > context.deadline - 10_000) {
    context.log(
      "Not enough time left in this run to generate the weekly report.",
    );
    return { skipped: "deadline" };
  }

  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 7),
  );

  const [
    analyticsOverview,
    leadStats,
    prospectStats,
    contentDrafts,
    emailSentStats,
  ] = await Promise.all([
    getAnalyticsOverview({ from: start, to: end }),
    getLeadStats(
      start,
      end,
      new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000),
    ),
    getProspectStats(start, end),
    getBlogPostsDrafts(start, end),
    countEmailsSentRange(start, end),
  ]);

  // Build metric data for the AI prompt
  const metrics = {
    pageviews: analyticsOverview.totals.pageviews,
    visitors: analyticsOverview.totals.visitors,
    leadsNew: leadStats.total,
    leadsPrevious: leadStats.previousTotal,
    leadsChange: leadStats.total - leadStats.previousTotal,
    prospectsNew: prospectStats.total,
    contentDrafts,
    emailsSent: emailSentStats.sent,
  };

  // Generate AI executive summary
  let aiSummary: string;
  try {
    const config = getAiProviderConfig();
    if (!config) {
      aiSummary = "AI provider not configured; skipping executive summary.";
    } else {
      const systemPrompt = `You are the Bitecodes growth assistant. Write a concise executive summary (3-5 sentences) of the past week's growth data for the owner. Focus on: traffic trends, lead flow, pipeline movement, and content drafts. Be factual, omit speculation, and keep it under 300 characters.`;

      const userPrompt = `Past week analytics:
- Page views: ${metrics.pageviews}
- Daily visitors: ${metrics.visitors}
- New leads: ${metrics.leadsNew} (change from prior week: ${metrics.leadsChange >= 0 ? "+" : ""}${metrics.leadsChange})
- New prospects: ${metrics.prospectsNew}
- Content drafts created: ${metrics.contentDrafts}
- Emails sent: ${metrics.emailsSent}

Generate a 3-5 sentence executive summary.`;

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 250,
        }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });

      if (!response.ok) {
        aiSummary = "Failed to generate AI summary.";
      } else {
        const payload = await response.json();
        const choice = payload.choices?.[0];
        if (!choice?.message?.content) {
          aiSummary = "AI returned no content.";
        } else {
          aiSummary = choice.message.content.trim();
          // Truncate to 300 characters if needed
          if (aiSummary.length > 300) {
            aiSummary = aiSummary.slice(0, 297) + "...";
          }
        }
      }
    }
  } catch (error) {
    aiSummary = "AI summary generation error.";
    context.log(
      `Weekly report AI summary error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const summaryText = aiSummary || "No AI summary available.";

  const recipients = getReportRecipients(settings);
  let emailed = 0;
  const emailErrors: string[] = [];
  const subject = `Weekly growth report — ${start.toISOString().slice(0, 10)}`;
  if (recipients.length > 0) {
    // A retry of this handler must not send the same week's report twice. The
    // scheduled job is deduplicated by its idempotency key, but a process that
    // dies after queueing and before completing the job is retried as new
    // work — so the already-queued recipients are read back from the outbox.
    const alreadyQueued = new Set(
      (
        await (
          await emailMessages()
        )
          .find({
            subject,
            category: "internal",
            createdAt: { $gte: start },
          })
          .project({ to: 1 })
          .toArray()
      ).map((document) => normalizeEmail(document.to)),
    );
    const pendingRecipients = recipients.filter(
      (to) => !alreadyQueued.has(normalizeEmail(to)),
    );

    if (pendingRecipients.length === 0) {
      context.log("Weekly report was already queued for every recipient.");
      return {
        skipped: "already-sent",
        summary: summaryText,
        emailed: 0,
        recipients: recipients.length,
        emailErrors,
        period: {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
          timezone: "UTC",
        },
        metrics,
      };
    }

    const blocks: EmailBlock[] = [
      {
        type: "p",
        text: `Weekly growth report — ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)} UTC.`,
      },
      { type: "p", text: summaryText },
      {
        type: "ul",
        items: [
          `Page views: ${metrics.pageviews}`,
          `Visitors: ${metrics.visitors}`,
          `New leads: ${metrics.leadsNew}`,
          `New prospects: ${metrics.prospectsNew}`,
          `Content drafts: ${metrics.contentDrafts}`,
          `Emails sent: ${metrics.emailsSent}`,
        ],
      },
    ];
    const results = await Promise.allSettled(
      pendingRecipients.map((to) =>
        queueEmail({
          to,
          subject,
          blocks,
          category: "internal",
          skipApproval: true,
          track: false,
        }),
      ),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        emailErrors.push(message);
        context.log(`Weekly report email error: ${message}`);
      } else if (result.value.status === "queued") {
        emailed += 1;
      } else {
        // The email gate refused the address; counting the resolved promise as
        // sent reported a report delivered that never entered the queue.
        emailErrors.push(
          `skipped: ${result.value.skipReason ?? result.value.status}`,
        );
        context.log(
          `Weekly report email skipped: ${result.value.skipReason ?? result.value.status}`,
        );
      }
    }
  } else {
    context.log("Weekly report has no configured recipients.");
  }

  context.log(`Weekly report generated: ${summaryText}`);

  return {
    skipped: false,
    summary: summaryText,
    emailed,
    recipients: recipients.length,
    emailErrors,
    period: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      timezone: "UTC",
    },
    metrics,
  };
}

function getReportRecipients(settings: ResolvedSettings): string[] {
  const env = getServerEnv();
  const configured = recipientsForChannel(settings, "ownerReports");
  if (configured.length > 0) return configured;
  // Mirrors `notify()`: fall back to the deployment address only while the
  // channel is enabled, so switching owner reports off actually stops them.
  return settings.notifications.channels.ownerReports.enabled
    ? [...new Set(env.CONTACT_NOTIFICATION_TO)]
    : [];
}

async function getLeadStats(from: Date, to: Date, previousFrom: Date) {
  const [total, previousTotal] = await Promise.all([
    countLeadsInRange(from, to),
    countLeadsInRange(previousFrom, from),
  ]);
  return { total, previousTotal };
}

async function getProspectStats(from: Date, to: Date) {
  const collection = await prospects();
  const total = await collection.countDocuments({
    createdAt: { $gte: from, $lt: to },
  });
  return { total };
}

async function getBlogPostsDrafts(from: Date, to: Date) {
  const collection = await blogPostDocs();
  return collection.countDocuments({
    status: "draft",
    createdAt: { $gte: from, $lt: to },
  });
}

async function countEmailsSentRange(from: Date, to: Date) {
  const collection = await emailMessages();
  const sent = await collection.countDocuments({
    status: "sent",
    sentAt: { $gte: from, $lt: to },
  });
  return { sent };
}
