import "server-only";

import { generateBlogDraft, pickTopic } from "@/lib/server/blog/generator";
import {
  createPost,
  publishDueScheduledPosts,
} from "@/lib/server/blog/repository";
import { pingIndexNow } from "@/lib/server/search-ping";
import { getSiteUrl } from "@/lib/server/env";
import { isAiConsultantConfigured } from "@/lib/server/ai-provider";
import { siteConfig } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
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
  if (!isAiConsultantConfigured()) {
    context.log("AI provider not configured; skipping blog generation.");
    return { skipped: "ai-not-configured" };
  }

  const dayOfYear =
    typeof payload.dayOfYear === "number" ? payload.dayOfYear : 0;
  const topic =
    typeof payload.topic === "string" ? payload.topic : pickTopic(dayOfYear);

  let draft;
  try {
    draft = await generateBlogDraft(topic);
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
