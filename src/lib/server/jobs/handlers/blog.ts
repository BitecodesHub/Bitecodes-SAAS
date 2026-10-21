import "server-only";

import { generateBlogDraft, pickTopic } from "@/lib/server/blog/generator";
import {
  createPost,
  publishDueScheduledPosts,
} from "@/lib/server/blog/repository";
import { pingIndexNow } from "@/lib/server/search-ping";
import { getSiteUrl } from "@/lib/server/env";
import {
  aiDeadlineWithin,
  getAutomationAiStatus,
} from "@/lib/server/ai/automation";
import { siteConfig } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { JobDeferredError } from "@/lib/server/jobs/queue";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * Blog generation.
 *
 * Drafts one post with the AI generator and — per the owner's choice —
 * publishes it immediately. Auto-published posts are flagged `aiAssisted` in
 * the database (an internal honesty marker, not shown as a disclaimer) and a
 * revision is snapshotted, so a human can always review or roll back.
 *
 * `dayOfYear` is passed through the payload rather than computed here, because
 * `Date` construction is restricted in some execution contexts; the enqueuer
 * stamps it.
 */
export async function handleBlogGenerate(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const ai = await getAutomationAiStatus();
  if (!ai.ready) {
    context.log(
      ai.enabled
        ? "No AI provider is configured; skipping blog generation."
        : "AI for automations is switched off; skipping blog generation.",
    );
    for (const warning of ai.warnings) context.log(warning);
    return { skipped: ai.enabled ? "ai-not-configured" : "ai-disabled" };
  }

  const dayOfYear =
    typeof payload.dayOfYear === "number" ? payload.dayOfYear : 0;
  const topic =
    typeof payload.topic === "string" ? payload.topic : pickTopic(dayOfYear);

  // Leave the run enough time to save, revalidate, and ping afterwards. The
  // worker only claims this type with 90 seconds left (JOB_MIN_BUDGET_MS), so
  // this is a backstop: a short run defers the job to the next cron run
  // without spending one of its attempts.
  const deadlineMs = aiDeadlineWithin(
    context.deadline,
    180_000,
    Date.now(),
    15_000,
  );
  if (deadlineMs < 30_000) {
    throw new JobDeferredError(
      "Not enough time left in this run to draft a post.",
    );
  }

  let draft;
  try {
    draft = await generateBlogDraft(topic, { deadlineMs });
  } catch (error) {
    // A bad generation is retryable — the worker will try again — so surface
    // it as a thrown error rather than a silent skip.
    throw new Error(
      `Blog generation failed for "${topic}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const { id, slug } = await createPost({
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    category: draft.category,
    tags: draft.tags,
    author: siteConfig.founder,
    body: draft.body,
    faq: draft.faq,
    internalLinks: draft.internalLinks,
    metaDescription: draft.metaDescription,
    readingMinutes: draft.readingMinutes,
    status: "published",
    featured: false,
    authorId: null,
    aiAssisted: true,
    aiModel: draft.model,
    scheduledFor: null,
  } as Parameters<typeof createPost>[0]);

  await recordAudit({
    action: AUDIT_ACTIONS.postPublished,
    target: { type: "blog_post", id },
    detail: { slug, topic, aiAssisted: true },
  });

  // Refresh the static-ish public pages so the new post appears immediately.
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");

  const pinged = await pingIndexNow([`/blog/${slug}`]);
  context.log(`Published "${draft.title}" at ${getSiteUrl()}/blog/${slug}.`);

  return { slug, title: draft.title, model: draft.model, pinged };
}

/**
 * Publishes any scheduled posts whose time has come, and pings search engines
 * for exactly those URLs.
 */
export async function handleBlogPublishScheduled(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const slugs = await publishDueScheduledPosts();
  if (slugs.length === 0) return { published: 0 };

  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  for (const slug of slugs) revalidatePath(`/blog/${slug}`);

  await pingIndexNow(slugs.map((slug) => `/blog/${slug}`));
  context.log(`Published ${slugs.length} scheduled post(s).`);
  return { published: slugs.length, slugs };
}
