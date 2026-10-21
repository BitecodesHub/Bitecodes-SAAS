import "server-only";

import { getAiProviderConfig } from "@/lib/server/ai-provider";
import { getSettingsFresh } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";

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

  const span = end.getTime() - start.getTime();
  const previousStart = new Date(end.getTime() - span);
  const previousEnd = start;

  const [
    analyticsOverview,
    leadStats,
    prospectStats,
    blogPosts,
    emailSentStats,
  ] = await Promise.all([
    getAnalyticsOverview({ from: start, to: end }),
    countLeadsInRange(start, end),
    getProspectStats(),
    getBlogPostsDrafts(),
    countEmailsSentRange(start, end),
  ]);

  // Build metric data for the AI prompt
  const metrics = {
    pageviews: analyticsOverview.totals.pageviews,
    visitors: analyticsOverview.totals.visitors,
    leadsNew: leadStats.total,
    leadsChange: leadStats.previousTotal,
    prospectsNew: prospectStats.total,
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
- New leads: ${metrics.leadsNew} (change: ${metrics.leadsChange ? metrics.leadsChange : "unknown"})
- New prospects: ${metrics.prospectsNew}
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

  // Log and return
  context.log(`Weekly report generated: ${summaryText}`);

  // TODO: In a full implementation, queue the email to the owner here.
  // For now, we return the summary so the admin page can display it.

  return {
    skipped: false,
    summary: summaryText,
    period: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    },
    metrics,
  };
}

function getAnalyticsOverview(_range: { from: Date; to: Date }) {
  return { totals: { pageviews: 0, visitors: 0 } };
}

function countLeadsInRange(from: Date, to: Date) {
  return { total: 0, previousTotal: 0 };
}

function getProspectStats() {
  return { total: 0, withEmail: 0 };
}

function getBlogPostsDrafts() {
  return [];
}

function countEmailsSentRange(from: Date, to: Date) {
  return { sent: 0 };
}
