import "server-only";

import { JOB_TYPES, type JobType } from "@/lib/server/jobs/queue";
import type { JobHandler } from "@/lib/server/jobs/worker";

/**
 * The job-handler registry.
 *
 * Handlers are registered here rather than discovered, so the set of work the
 * worker can perform is explicit and reviewable in one place. A job whose type
 * has no entry is dead-lettered immediately rather than retried — see
 * `runDueJobs`.
 *
 * Handler modules are imported lazily inside each entry so that pulling in the
 * worker does not pull in every provider client, mailer, and audit path.
 */

const registry: Partial<Record<JobType, JobHandler>> = {};

/** Registers a handler. Later registrations for the same type replace earlier. */
export function registerJobHandler(type: JobType, handler: JobHandler) {
  registry[type] = handler;
}

export function getJobHandlers(): Partial<Record<JobType, JobHandler>> {
  ensureHandlersRegistered();
  return registry;
}

let registered = false;

function ensureHandlersRegistered() {
  if (registered) return;
  registered = true;

  registerJobHandler(JOB_TYPES.emailSend, async (payload, context) => {
    const { handleEmailSend } =
      await import("@/lib/server/jobs/handlers/email-send");
    return handleEmailSend(payload, context);
  });

  registerJobHandler(JOB_TYPES.prospectDiscover, async (payload, context) => {
    const { handleProspectDiscover } =
      await import("@/lib/server/jobs/handlers/prospect-discover");
    return handleProspectDiscover(payload, context);
  });

  registerJobHandler(JOB_TYPES.sequenceTick, async (_payload, context) => {
    const { tickSequences } = await import("@/lib/server/email/sequences");
    const summary = await tickSequences();
    context.log(
      `${summary.due} due, ${summary.sent} sent, ${summary.completed} completed, ${summary.stopped} stopped.`,
    );
    return summary as unknown as Record<string, unknown>;
  });

  registerJobHandler(JOB_TYPES.prospectEnrich, async (payload, context) => {
    const { handleProspectEnrich } =
      await import("@/lib/server/jobs/handlers/prospect-enrich");
    return handleProspectEnrich(payload, context);
  });

  registerJobHandler(JOB_TYPES.autopilotTick, async (_payload, context) => {
    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const summary = await runAutopilotTick();
    const discovery = summary.presetRun
      ? `Discovery preset run: ${summary.presetRun}.`
      : "Discovery: no preset due.";
    context.log(
      summary.enabled
        ? `${discovery} ${summary.enrolled}/${summary.candidates} candidate(s) enrolled.`
        : `${discovery} Auto-enrolment is off; prospects were discovered but not contacted.`,
    );
    return summary as unknown as Record<string, unknown>;
  });

  registerJobHandler(JOB_TYPES.dailyDigest, async (payload, context) => {
    const { handleDailyDigest } =
      await import("@/lib/server/jobs/handlers/daily-digest");
    return handleDailyDigest(payload, context);
  });

  registerJobHandler(JOB_TYPES.replyPoll, async (payload, context) => {
    const { handleReplyPoll } =
      await import("@/lib/server/jobs/handlers/reply-poll");
    return handleReplyPoll(payload, context);
  });

  registerJobHandler(JOB_TYPES.blogGenerate, async (payload, context) => {
    const { handleBlogGenerate } =
      await import("@/lib/server/jobs/handlers/blog");
    return handleBlogGenerate(payload, context);
  });

  registerJobHandler(
    JOB_TYPES.blogPublishScheduled,
    async (payload, context) => {
      const { handleBlogPublishScheduled } =
        await import("@/lib/server/jobs/handlers/blog");
      return handleBlogPublishScheduled(payload, context);
    },
  );

  // Growth engine. Each module is owned by one package (see schedule.ts).

  registerJobHandler(JOB_TYPES.analyticsRollup, async (payload, context) => {
    const { handleAnalyticsRollup } =
      await import("@/lib/server/jobs/handlers/analytics-rollup");
    return handleAnalyticsRollup(payload, context);
  });

  registerJobHandler(JOB_TYPES.chatSummaries, async (payload, context) => {
    const { handleChatSummaries } =
      await import("@/lib/server/jobs/handlers/chat-summaries");
    return handleChatSummaries(payload, context);
  });

  registerJobHandler(JOB_TYPES.churnScan, async (payload, context) => {
    const { handleChurnScan } =
      await import("@/lib/server/jobs/handlers/churn-scan");
    return handleChurnScan(payload, context);
  });

  registerJobHandler(JOB_TYPES.leadScore, async (payload, context) => {
    const { handleLeadScore } =
      await import("@/lib/server/jobs/handlers/lead-score");
    return handleLeadScore(payload, context);
  });

  registerJobHandler(JOB_TYPES.prospectResearch, async (payload, context) => {
    const { handleProspectResearch } =
      await import("@/lib/server/jobs/handlers/prospect-research");
    return handleProspectResearch(payload, context);
  });

  registerJobHandler(JOB_TYPES.outreachDraft, async (payload, context) => {
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");
    return handleOutreachDraft(payload, context);
  });

  registerJobHandler(JOB_TYPES.lifecycleTick, async (payload, context) => {
    const { handleLifecycleTick } =
      await import("@/lib/server/jobs/handlers/lifecycle");
    return handleLifecycleTick(payload, context);
  });

  registerJobHandler(JOB_TYPES.searchPing, async (payload, context) => {
    const { handleSearchPing } =
      await import("@/lib/server/jobs/handlers/search-ping");
    return handleSearchPing(payload, context);
  });

  registerJobHandler(JOB_TYPES.proposalFollowups, async (payload, context) => {
    const { handleProposalFollowups } =
      await import("@/lib/server/jobs/handlers/proposal-followups");
    return handleProposalFollowups(payload, context);
  });

  registerJobHandler(JOB_TYPES.bookingReminders, async (payload, context) => {
    const { handleBookingReminders } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    return handleBookingReminders(payload, context);
  });

  registerJobHandler(JOB_TYPES.reportWeekly, async (payload, context) => {
    const { handleWeeklyReport } =
      await import("@/lib/server/jobs/handlers/report-weekly");
    return handleWeeklyReport(payload, context);
  });

  registerJobHandler(JOB_TYPES.socialDrafts, async (payload, context) => {
    const { handleSocialDrafts } =
      await import("@/lib/server/jobs/handlers/social-drafts");
    return handleSocialDrafts(payload, context);
  });

  registerJobHandler(JOB_TYPES.feedbackRequests, async (payload, context) => {
    const { handleFeedbackRequests } =
      await import("@/lib/server/jobs/handlers/feedback-requests");
    return handleFeedbackRequests(payload, context);
  });

  registerJobHandler(JOB_TYPES.newsletterDraft, async (payload, context) => {
    const { handleNewsletterDraft } =
      await import("@/lib/server/jobs/handlers/newsletter-draft");
    return handleNewsletterDraft(payload, context);
  });

  registerJobHandler(JOB_TYPES.seoSelfAudit, async (payload, context) => {
    const { handleSeoSelfAudit } =
      await import("@/lib/server/jobs/handlers/seo-selfaudit");
    return handleSeoSelfAudit(payload, context);
  });

  registerJobHandler(JOB_TYPES.reportMonthly, async (payload, context) => {
    const { handleMonthlyReports } =
      await import("@/lib/server/jobs/handlers/report-monthly");
    return handleMonthlyReports(payload, context);
  });

  registerJobHandler(JOB_TYPES.referralReconcile, async (payload, context) => {
    const { handleReferralReconcile } =
      await import("@/lib/server/jobs/handlers/referral-reconcile");
    return handleReferralReconcile(payload, context);
  });
}

/** Test seam: forget registrations so a suite can install its own. */
export function resetJobHandlers() {
  registered = false;
  for (const key of Object.keys(registry)) {
    delete registry[key as JobType];
  }
}
