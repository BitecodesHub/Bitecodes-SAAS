import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { getSettingsFresh } from "@/lib/server/settings";
import { socialDrafts } from "@/lib/server/db/collections";
import type { SocialDraftDoc } from "@/lib/server/db/types";
import { blogPosts } from "@/data/blog";
import type { BlogPost } from "@/types/content";
import {
  aiDeadlineWithin,
  completeText,
  getAutomationAiStatus,
} from "@/lib/server/ai/automation";

/**
 * `social.drafts` — Drafts LinkedIn posts from recent articles; never posts.
 *
 * Contract: return `{ skipped: "disabled" }` when
 * `settings.growth.socialDrafts` is off, stay idempotent, respect
 * `context.deadline`, and return a small JSON summary.
 */
export async function handleSocialDrafts(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.socialDrafts) {
    context.log("Social drafts are switched off in growth settings.");
    return { skipped: "disabled" };
  }

  if (context.deadline && Date.now() > context.deadline) {
    context.log("Deadline reached before social drafts started.");
    return { skipped: "deadline" };
  }

  // Idempotency: check if a draft for this week key already exists
  const collection = await socialDrafts();
  const now = new Date();
  const year = now.getFullYear();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000,
  );
  const week = Math.ceil(
    (dayOfYear + new Date(Date.UTC(year, 0, 1)).getUTCDay() + 1) / 7,
  );
  const weekKey = `${year}-W${String(week).padStart(2, "0")}`;

  const existing = await collection.findOne({ weekKey });
  if (existing && existing.status !== "discarded") {
    context.log(`Social draft already exists for ${weekKey}.`);
    return { skipped: "duplicate", weekKey };
  }

  // Select recent blog posts (last 14 days) as source material, or fallback to all posts
  const recentPosts: BlogPost[] = blogPosts.filter((post) => {
    const postDate = new Date(post.date);
    const diffDays = Math.floor(
      (now.getTime() - postDate.getTime()) / 86400000,
    );
    return diffDays >= 0 && diffDays <= 14;
  });

  const sourcePosts = recentPosts.length > 0 ? recentPosts : blogPosts;
  const selectedPost = sourcePosts[0];

  // Base fallback draft
  let body = "";
  if (selectedPost) {
    body = `${selectedPost.title}\n\n${selectedPost.excerpt}\n\nRead more: https://bitecodes.com/blog/${selectedPost.slug}`;
  } else {
    body =
      "Building software that endures: prioritizing architectural clarity, high-performance edge compute, and deterministic system behavior over rapid technical debt accumulation.\n\nRead more engineering notes at https://bitecodes.com/blog";
  }

  let aiModel: string | null = null;
  const aiStatus = await getAutomationAiStatus();
  if (aiStatus.ready && selectedPost) {
    const aiDeadline = aiDeadlineWithin(
      context.deadline,
      40_000,
      Date.now(),
      5_000,
    );
    if (aiDeadline >= 10_000) {
      try {
        const aiResult = await completeText({
          purpose: "social-draft",
          system:
            "You write LinkedIn posts from the perspective of the founder of Bitecodes, an elite software engineering & digital product studio. Tone: quiet confidence, deeply technical, precise, zero hype, no buzzwords, no emojis, no hashtag stuffing (maximum 2 relevant technical hashtags at the end). Extract a profound, counterintuitive technical or architectural lesson from the article.",
          user: `Article title: "${selectedPost.title}"\nExcerpt: "${selectedPost.excerpt}"\nArticle URL: https://bitecodes.com/blog/${selectedPost.slug}\n\nWrite a LinkedIn post summarizing this insight concisely with a link to read more at the end.`,
          deadlineMs: aiDeadline,
          temperature: 0.5,
        });

        if (aiResult.text.length > 30) {
          body = aiResult.text;
          aiModel = aiResult.model;
          context.log(`Social draft generated using AI model: ${aiModel}`);
        }
      } catch (err) {
        context.log(
          `AI social draft failed, fell back to default summary: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const result: SocialDraftDoc = {
    _id: undefined,
    channel: "linkedin",
    weekKey,
    body,
    sourcePostSlug: selectedPost?.slug ?? null,
    status: "draft",
    aiModel,
    postedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(result);

  return {
    skipped: false,
    weekKey,
    status: "draft",
    aiModel,
    bodyPreview: body.slice(0, 100),
  };
}
