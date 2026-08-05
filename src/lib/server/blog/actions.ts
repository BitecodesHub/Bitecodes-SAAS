"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { kickJobs } from "@/lib/server/jobs/worker";
import { enqueueJob, JOB_TYPES } from "@/lib/server/jobs/queue";
import {
  createPost,
  deletePost,
  setPostStatus,
  updatePost,
} from "@/lib/server/blog/repository";
import { generateBlogDraft } from "@/lib/server/blog/generator";
import { pingIndexNow } from "@/lib/server/search-ping";
import { siteConfig } from "@/lib/site";

/**
 * Admin blog actions.
 *
 * Every action re-authorises with `write_content` — the button being hidden
 * from a viewer is presentation, not protection. Publishing revalidates the
 * public pages and pings search engines, so a hand-published post behaves
 * exactly like an autopilot-published one.
 */

export type BlogActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h2"), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal("h3"), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal("p"), text: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("ul"), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("ol"), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal("quote"),
    text: z.string().min(1),
    attribution: z.string().optional(),
  }),
  z.object({
    type: z.literal("code"),
    text: z.string().min(1),
    language: z.string().optional(),
  }),
  z.object({
    type: z.literal("cta"),
    text: z.string().min(1),
    label: z.string().min(1),
    path: z.string().min(1),
  }),
]);

const savuSchema = z.object({
  title: z.string().trim().min(6).max(160),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, "Use lowercase words joined by hyphens."),
  excerpt: z.string().trim().min(20).max(400),
  category: z.string().trim().min(2).max(40),
  tags: z.array(z.string().trim().min(2).max(30)).min(1).max(8),
  metaDescription: z.string().trim().max(400).nullable(),
  body: z.array(blockSchema).min(1),
  faq: z
    .array(
      z.object({
        question: z.string().trim().min(6).max(200),
        answer: z.string().trim().min(10).max(800),
      }),
    )
    .max(10),
  internalLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        path: z.string().trim().min(1).max(120),
      }),
    )
    .max(10),
  readingMinutes: z.number().int().min(1).max(60),
  featured: z.boolean(),
});

export type BlogPostInput = z.input<typeof savuSchema>;

export async function createPostAction(
  input: BlogPostInput & { status: "draft" | "published" },
): Promise<BlogActionResult<{ id: string; slug: string }>> {
  const session = await assertCapability("write_content");
  const parsed = savuSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Check the fields.");
  }
  const status = input.status === "published" ? "published" : "draft";

  const result = await createPost({
    ...parsed.data,
    author: siteConfig.founder,
    status,
    authorId: session.userId,
    aiAssisted: false,
    aiModel: null,
    scheduledFor: null,
  } as Parameters<typeof createPost>[0]);

  await recordAudit({
    action:
      status === "published"
        ? AUDIT_ACTIONS.postPublished
        : AUDIT_ACTIONS.postCreated,
    actorId: session.userId,
    target: { type: "blog_post", id: result.id },
    detail: { slug: result.slug, status },
  });

  if (status === "published") {
    revalidatePath("/blog");
    revalidatePath(`/blog/${result.slug}`);
    revalidatePath("/sitemap.xml");
    after(() => pingIndexNow([`/blog/${result.slug}`]));
  }
  revalidatePath("/admin/blog");
  return { ok: true, data: result };
}

export async function updatePostAction(
  id: string,
  input: BlogPostInput & { status: "draft" | "published" | "archived" },
): Promise<BlogActionResult<{ slug: string }>> {
  const session = await assertCapability("write_content");
  const parsed = savuSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Check the fields.");
  }

  const status =
    input.status === "published"
      ? "published"
      : input.status === "archived"
        ? "archived"
        : "draft";

  const ok = await updatePost(
    id,
    {
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      category: parsed.data.category,
      tags: parsed.data.tags,
      body: parsed.data.body,
      faq: parsed.data.faq,
      internalLinks: parsed.data.internalLinks,
      metaDescription: parsed.data.metaDescription,
      readingMinutes: parsed.data.readingMinutes,
      featured: parsed.data.featured,
      status,
    },
    session.userId,
  );
  if (!ok) return failure("That post no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.postUpdated,
    actorId: session.userId,
    target: { type: "blog_post", id },
    detail: { slug: parsed.data.slug, status },
  });

  revalidatePath("/blog");
  revalidatePath(`/blog/${parsed.data.slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/blog");
  if (status === "published")
    after(() => pingIndexNow([`/blog/${parsed.data.slug}`]));
  return { ok: true, data: { slug: parsed.data.slug } };
}

export async function setPostStatusAction(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<BlogActionResult> {
  const session = await assertCapability("write_content");
  const ok = await setPostStatus(id, status);
  if (!ok) return failure("That post no longer exists.");

  await recordAudit({
    action:
      status === "published"
        ? AUDIT_ACTIONS.postPublished
        : AUDIT_ACTIONS.postUnpublished,
    actorId: session.userId,
    target: { type: "blog_post", id },
    detail: { status },
  });

  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/blog");
  return { ok: true };
}

export async function deletePostAction(id: string): Promise<BlogActionResult> {
  const session = await assertCapability("write_content");
  const ok = await deletePost(id);
  if (!ok) return failure("That post no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.postDeleted,
    actorId: session.userId,
    target: { type: "blog_post", id },
  });

  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/blog");
  return { ok: true };
}

/**
 * Drafts a post with AI on demand and saves it as a draft for review.
 * Returns the new id so the editor can open it.
 */
export async function generateDraftAction(
  topic: string,
): Promise<BlogActionResult<{ id: string; slug: string; title: string }>> {
  const session = await assertCapability("write_content");
  const cleaned = topic.trim().slice(0, 200);
  if (cleaned.length < 8)
    return failure("Give a topic of at least 8 characters.");

  let draft;
  try {
    draft = await generateBlogDraft(cleaned);
  } catch (error) {
    return failure(
      error instanceof Error && error.message === "NOT_CONFIGURED"
        ? "The AI provider is not configured. Set AI_API_KEY or OPENROUTER_API_KEY."
        : "The draft could not be generated. Try again in a moment.",
    );
  }

  const result = await createPost({
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
    status: "draft",
    featured: false,
    authorId: session.userId,
    aiAssisted: true,
    aiModel: draft.model,
    scheduledFor: null,
  } as Parameters<typeof createPost>[0]);

  await recordAudit({
    action: AUDIT_ACTIONS.aiDraftGenerated,
    actorId: session.userId,
    target: { type: "blog_post", id: result.id },
    detail: { topic: cleaned, model: draft.model },
  });

  revalidatePath("/admin/blog");
  return {
    ok: true,
    data: { id: result.id, slug: result.slug, title: draft.title },
  };
}

/**
 * Fires a full autopilot-style generate-and-publish run immediately, using the
 * rotating topic bank. Mirrors the scheduled job so the owner can trigger a
 * post on demand.
 */
export async function runBlogGenerateNowAction(): Promise<
  BlogActionResult<{ queued: true }>
> {
  const session = await assertCapability("write_content");
  await enqueueJob({
    type: JOB_TYPES.blogGenerate,
    payload: { dayOfYear: Math.floor(Date.now() / 86_400_000) % 365 },
    idempotencyKey: `blog-generate-manual:${Date.now()}`,
  });
  await recordAudit({
    action: AUDIT_ACTIONS.aiDraftGenerated,
    actorId: session.userId,
    detail: { trigger: "manual-publish-run" },
  });
  after(() => kickJobs(30_000));
  return { ok: true, data: { queued: true } };
}
