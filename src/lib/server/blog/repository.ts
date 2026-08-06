import "server-only";

import { ObjectId } from "mongodb";
import { blogPostDocs, blogRevisions } from "@/lib/server/db/collections";
import type { BlogPostDoc, BlogStatus } from "@/lib/server/db/types";
import type { BlogPost } from "@/types/content";
import { blogPosts as staticPosts } from "@/data/blog";

/**
 * Blog data layer.
 *
 * The public site has always read `src/data/blog.ts`. Database posts are
 * merged on top of those static ones rather than replacing them, so the
 * hand-written founding posts survive and AI-published posts join the same
 * list. A database slug shadows a static slug of the same name, which is how a
 * static post could later be superseded by an edited database copy.
 */

/** Maps a stored document to the public `BlogPost` shape the site renders. */
export function toPublicPost(doc: BlogPostDoc): BlogPost {
  return {
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    category: doc.category,
    tags: doc.tags,
    author: doc.author,
    date: doc.date,
    readingMinutes: doc.readingMinutes,
    body: doc.body,
    featured: doc.featured,
    metaDescription: doc.metaDescription,
    faq: doc.faq,
    internalLinks: doc.internalLinks,
    aiAssisted: doc.aiAssisted,
  };
}

/**
 * Every published post the public site should show — database first (newest
 * by date), then any static post whose slug a database post has not taken over.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    const collection = await blogPostDocs();
    const dbDocs = await collection
      .find({ status: "published" })
      .sort({ date: -1 })
      .toArray();

    const dbPosts = dbDocs.map(toPublicPost);
    const dbSlugs = new Set(dbPosts.map((p) => p.slug));
    const survivingStatic = staticPosts.filter((p) => !dbSlugs.has(p.slug));

    return [...dbPosts, ...survivingStatic].sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  } catch {
    // The blog, sitemap, and feeds are core SEO surfaces. If the database is
    // unreachable, serve the compiled-in static posts rather than a 500 — the
    // public site must never depend on the database being up.
    return [...staticPosts].sort((a, b) => (a.date < b.date ? 1 : -1));
  }
}

export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  try {
    const collection = await blogPostDocs();
    const doc = await collection.findOne({ slug, status: "published" });
    if (doc) return toPublicPost(doc);
  } catch {
    // Fall through to the static set on a database failure.
  }
  return staticPosts.find((p) => p.slug === slug) ?? null;
}

/**
 * Related published posts, scored by shared category and tags — the same
 * ranking the static `relatedPosts` used, over the merged published set.
 */
export async function getRelatedPublishedPosts(
  slug: string,
  limit = 3,
): Promise<BlogPost[]> {
  const all = await getPublishedPosts();
  const current = all.find((p) => p.slug === slug);
  if (!current) return [];
  return all
    .filter((p) => p.slug !== slug)
    .map((post) => ({
      post,
      score:
        (post.category === current.category ? 2 : 0) +
        post.tags.filter((t) => current.tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post);
}

export async function slugExists(slug: string): Promise<boolean> {
  if (staticPosts.some((p) => p.slug === slug)) return true;
  const collection = await blogPostDocs();
  return Boolean(
    await collection.findOne({ slug }, { projection: { _id: 1 } }),
  );
}

// --- Admin-side reads and writes -------------------------------------------

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  status: BlogStatus;
  category: string;
  date: string;
  aiAssisted: boolean;
  updatedAt: string;
}

function toSummary(doc: BlogPostDoc): BlogPostSummary {
  return {
    id: doc._id?.toHexString() ?? "",
    slug: doc.slug,
    title: doc.title,
    status: doc.status,
    category: doc.category,
    date: doc.date,
    aiAssisted: doc.aiAssisted,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listAllPosts(): Promise<BlogPostSummary[]> {
  const collection = await blogPostDocs();
  const docs = await collection
    .find({})
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray();
  return docs.map(toSummary);
}

export async function getPostById(id: string): Promise<BlogPostDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await blogPostDocs();
  return collection.findOne({ _id: new ObjectId(id) });
}

export interface CreatePostInput {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  body: BlogPostDoc["body"];
  faq: BlogPostDoc["faq"];
  internalLinks: BlogPostDoc["internalLinks"];
  metaDescription: string | null;
  readingMinutes: number;
  status: BlogStatus;
  featured: boolean;
  authorId: string | null;
  aiAssisted: boolean;
  aiModel: string | null;
  scheduledFor: Date | null;
  /** ISO date (YYYY-MM-DD). Defaults to today when omitted. */
  date?: string;
}

export async function createPost(
  input: CreatePostInput,
): Promise<{ id: string; slug: string }> {
  const collection = await blogPostDocs();
  const now = new Date();
  const published = input.status === "published";

  const doc: Omit<BlogPostDoc, "_id"> = {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    category: input.category,
    tags: input.tags,
    author: input.author,
    date: input.date ?? now.toISOString().slice(0, 10),
    readingMinutes: input.readingMinutes,
    body: input.body,
    featured: input.featured,
    status: input.status,
    metaDescription: input.metaDescription,
    faq: input.faq,
    internalLinks: input.internalLinks,
    publishedAt: published ? now : null,
    scheduledFor: input.scheduledFor,
    authorId: input.authorId,
    aiAssisted: input.aiAssisted,
    aiModel: input.aiModel,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  } as Omit<BlogPostDoc, "_id"> & { date: string };

  const result = await collection.insertOne(doc as BlogPostDoc);
  await snapshot(result.insertedId.toHexString(), doc as BlogPostDoc, 1);
  return { id: result.insertedId.toHexString(), slug: input.slug };
}

export async function updatePost(
  id: string,
  patch: Partial<
    Pick<
      BlogPostDoc,
      | "title"
      | "excerpt"
      | "category"
      | "tags"
      | "body"
      | "faq"
      | "internalLinks"
      | "metaDescription"
      | "status"
      | "featured"
      | "readingMinutes"
    >
  >,
  authorId: string | null,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await blogPostDocs();
  const existing = await collection.findOne({ _id: new ObjectId(id) });
  if (!existing) return false;

  const now = new Date();
  const nextRevision = existing.revision + 1;
  const becomingPublished =
    patch.status === "published" && existing.status !== "published";

  const updated: BlogPostDoc = {
    ...existing,
    ...patch,
    revision: nextRevision,
    publishedAt: becomingPublished ? now : existing.publishedAt,
    updatedAt: now,
  };

  await collection.updateOne({ _id: existing._id }, { $set: updated });
  await snapshot(id, updated, nextRevision, authorId);
  return true;
}

export async function setPostStatus(
  id: string,
  status: BlogStatus,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await blogPostDocs();
  const now = new Date();
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
        updatedAt: now,
        ...(status === "published" ? { publishedAt: now } : {}),
      },
    },
  );
  return result.matchedCount === 1;
}

export async function deletePost(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await blogPostDocs();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/**
 * Publishes scheduled posts whose time has come. Returns the slugs published,
 * so the caller can ping search engines for exactly those URLs.
 */
export async function publishDueScheduledPosts(
  now = new Date(),
): Promise<string[]> {
  const collection = await blogPostDocs();
  const due = await collection
    .find({ status: "scheduled", scheduledFor: { $lte: now } })
    .toArray();

  const published: string[] = [];
  for (const doc of due) {
    await collection.updateOne(
      { _id: doc._id },
      { $set: { status: "published", publishedAt: now, updatedAt: now } },
    );
    published.push(doc.slug);
  }
  return published;
}

async function snapshot(
  postId: string,
  doc: BlogPostDoc,
  revision: number,
  authorId: string | null = null,
): Promise<void> {
  const collection = await blogRevisions();
  const { _id, ...rest } = doc;
  void _id;
  await collection.insertOne({
    postId,
    revision,
    snapshot: rest,
    authorId: authorId ?? doc.authorId,
    createdAt: new Date(),
  });
}
