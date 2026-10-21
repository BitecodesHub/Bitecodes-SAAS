import { describe, expect, it } from "vitest";
import { getJobHandlers } from "@/lib/server/jobs/handlers";
import { JOB_TYPES } from "@/lib/server/jobs/queue";
import { RECURRING_AUTOMATIONS } from "@/lib/server/jobs/schedule";

/**
 * The registry must cover every declared job type: a queued job with no
 * handler is dead-lettered on its first claim, so a gap here silently kills
 * an automation in production.
 */
describe("job handler registry", () => {
  const jobTypes = Object.values(JOB_TYPES) as string[];

  it("registers a handler for every JOB_TYPES value", () => {
    const handlers = getJobHandlers() as Record<string, unknown>;
    for (const type of jobTypes) {
      expect(typeof handlers[type], type).toBe("function");
    }
  });

  it("schedules only declared job types", () => {
    for (const automation of RECURRING_AUTOMATIONS) {
      expect(jobTypes, automation.id).toContain(automation.type);
    }
  });

  it("has unique JOB_TYPES values", () => {
    expect(new Set(jobTypes).size).toBe(jobTypes.length);
  });

  /** The handler file and export each package must keep (the contract table). */
  const CONTRACT: [string, string, string][] = [
    ["analytics.rollup", "analytics-rollup", "handleAnalyticsRollup"],
    ["chat.summaries", "chat-summaries", "handleChatSummaries"],
    ["churn.scan", "churn-scan", "handleChurnScan"],
    ["lead.score", "lead-score", "handleLeadScore"],
    ["prospect.research", "prospect-research", "handleProspectResearch"],
    ["outreach.draft", "outreach-draft", "handleOutreachDraft"],
    ["digest.daily", "daily-digest", "handleDailyDigest"],
    ["lifecycle.tick", "lifecycle", "handleLifecycleTick"],
    ["search.ping", "search-ping", "handleSearchPing"],
    ["proposal.followups", "proposal-followups", "handleProposalFollowups"],
    ["booking.reminders", "booking-reminders", "handleBookingReminders"],
    ["report.weekly", "report-weekly", "handleWeeklyReport"],
    ["social.drafts", "social-drafts", "handleSocialDrafts"],
    ["feedback.requests", "feedback-requests", "handleFeedbackRequests"],
    ["newsletter.draft", "newsletter-draft", "handleNewsletterDraft"],
    ["blog.generate", "blog", "handleBlogGenerate"],
    ["seo.selfaudit", "seo-selfaudit", "handleSeoSelfAudit"],
    ["report.monthly", "report-monthly", "handleMonthlyReports"],
  ];

  it.each(CONTRACT)(
    "%s is declared, scheduled, and exported as handlers/%s.ts %s",
    async (type, file, exportName) => {
      expect(jobTypes).toContain(type);
      expect(RECURRING_AUTOMATIONS.map((a) => a.type)).toContain(type);
      const mod = (await import(`./handlers/${file}.ts`)) as Record<
        string,
        unknown
      >;
      expect(typeof mod[exportName]).toBe("function");
    },
  );
});
