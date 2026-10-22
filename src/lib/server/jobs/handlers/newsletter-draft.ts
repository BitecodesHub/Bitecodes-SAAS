import "server-only";

import { z } from "zod";
import type { JobContext } from "@/lib/server/jobs/worker";
import { getSettingsFresh } from "@/lib/server/settings";
import { newsletterIssues } from "@/lib/server/db/collections";
import type { NewsletterIssueDoc } from "@/lib/server/db/types";
import type { EmailBlock } from "@/lib/email/template";
import { blogPosts } from "@/data/blog";
import {
  aiDeadlineWithin,
  completeJson,
  getAutomationAiStatus,
} from "@/lib/server/ai/automation";

const newsletterSchema = z.object({
  subject: z.string().min(5).max(120),
  preheader: z.string().min(5).max(200),
  introText: z.string().min(10),
  h2Title: z.string().min(5),
  highlights: z.array(z.string().min(5)).min(2).max(5),
  ctaLabel: z.string().min(3),
  ctaUrl: z.string().min(1),
  signature: z.string().min(2),
});

/**
 * `newsletter.draft` — Drafts the weekly newsletter for approval.
 *
 * Contract: return `{ skipped: "disabled" }` when
 * `settings.growth.newsletterDrafts` is off, stay idempotent, respect
 * `context.deadline`, and return a small JSON summary.
 */
export async function handleNewsletterDraft(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.newsletterDrafts) {
    context.log("Newsletter drafts are switched off in growth settings.");
    return { skipped: "disabled" };
  }

  if (context.deadline && Date.now() > context.deadline) {
    context.log("Deadline reached before newsletter draft started.");
    return { skipped: "deadline" };
  }

  // Idempotency: check if a draft for this week key already exists
  const collection = await newsletterIssues();
  const now = new Date();
  const year = now.getFullYear();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000,
  );
  const week = Math.ceil(
    (dayOfYear + new Date(Date.UTC(year, 0, 1)).getUTCDay() + 1) / 7,
  );
  const issueKey = `${year}-W${String(week).padStart(2, "0")}`;

  const existing = await collection.findOne({ issueKey });
  if (existing && existing.status !== "discarded") {
    context.log(`Newsletter draft already exists for ${issueKey}.`);
    return { skipped: "duplicate", issueKey };
  }

  // Select source material: latest blog posts
  const recentPost = blogPosts[0];
  const postContext = recentPost
    ? `Latest article: "${recentPost.title}" (${recentPost.excerpt}) - URL: https://bitecodes.com/blog/${recentPost.slug}`
    : "Focus on modern web architecture, AI integrations, performance engineering, and reliable digital systems.";

  let subject = `Bitecodes Weekly - Week ${week}`;
  let preheader =
    "Practical software engineering, AI patterns, and product architecture";
  let blocks: EmailBlock[] = [
    {
      type: "p",
      text: "Welcome to this week's edition. We share actionable engineering notes, system architecture teardowns, and practical AI implementations without the hype.",
    },
    {
      type: "h2",
      text: recentPost ? recentPost.title : "Engineering Insights",
    },
    {
      type: "p",
      text: recentPost
        ? recentPost.excerpt
        : "Discover key architectural techniques for building resilient systems.",
    },
    {
      type: "ul",
      items: [
        "Eliminate latency bottlenecks with edge-first data caches",
        "Type safety patterns across asynchronous job queues",
        "Deterministic fallbacks for mission-critical AI flows",
      ],
    },
    {
      type: "cta",
      label: recentPost
        ? "Read the Full Post"
        : "Explore Engineering Resources",
      url: recentPost
        ? `https://bitecodes.com/blog/${recentPost.slug}`
        : "https://bitecodes.com/resources",
    },
    {
      type: "signature",
      text: "The Bitecodes Engineering Team\nhttps://bitecodes.com",
    },
  ];
  let aiModel: string | null = null;

  const aiStatus = await getAutomationAiStatus();
  if (aiStatus.ready) {
    const aiDeadline = aiDeadlineWithin(
      context.deadline,
      45_000,
      Date.now(),
      5_000,
    );
    if (aiDeadline >= 10_000) {
      try {
        const aiResult = await completeJson({
          purpose: "newsletter-draft",
          system:
            "You are the senior editorial engineer at Bitecodes. Write a thoughtful, restrained, Apple-quiet weekly technical newsletter for technical founders, CTOs, and product engineers. No buzzwords, no emojis, no inflated claims. Deliver concrete technical insights.",
          user: `Draft this week's newsletter (Week ${week}). ${postContext}`,
          schema: newsletterSchema,
          deadlineMs: aiDeadline,
          temperature: 0.4,
        });

        const d = aiResult.data;
        subject = d.subject;
        preheader = d.preheader;
        blocks = [
          { type: "p", text: d.introText },
          { type: "h2", text: d.h2Title },
          { type: "ul", items: d.highlights },
          { type: "cta", label: d.ctaLabel, url: d.ctaUrl },
          { type: "signature", text: d.signature },
        ];
        aiModel = aiResult.model;
        context.log(`Newsletter drafted using AI model: ${aiModel}`);
      } catch (err) {
        context.log(
          `AI draft failed, fell back to curated template: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const result: NewsletterIssueDoc = {
    _id: undefined,
    issueKey,
    subject,
    preheader,
    blocks,
    status: "draft",
    aiModel,
    approvedById: null,
    approvedAt: null,
    sentAt: null,
    recipientCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(result);

  return {
    skipped: false,
    issueKey,
    status: "draft",
    subject: result.subject,
    aiModel,
  };
}
