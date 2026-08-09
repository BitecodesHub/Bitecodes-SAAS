import { describe, expect, it } from "vitest";
import { toPublicPost } from "@/lib/server/blog/repository";
import type { BlogPostDoc } from "@/lib/server/db/types";

/**
 * `dateModified` in the article's JSON-LD, and `lastModified` in the sitemap,
 * both read `post.updatedAt`. Before this, `toPublicPost` dropped the field
 * entirely, and both call sites fell back to `post.date` — so the schema
 * reported EVERY post as modified on exactly its publish date, forever, no
 * matter how many times it was actually edited afterwards. This pins the one
 * new thing `toPublicPost` now does: carry `updatedAt` through.
 */
describe("toPublicPost", () => {
  const baseDoc: BlogPostDoc = {
    slug: "example-post",
    title: "Example Post",
    excerpt: "An example.",
    category: "Engineering",
    tags: ["next.js"],
    author: "Someone",
    date: "2026-01-01",
    readingMinutes: 4,
    body: [],
    status: "published",
    featured: false,
    metaDescription: null,
    faq: [],
    internalLinks: [],
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    scheduledFor: null,
    authorId: null,
    aiAssisted: false,
    aiModel: null,
    revision: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-15T09:30:00.000Z"),
  };

  it("carries updatedAt through as an ISO string", () => {
    const post = toPublicPost(baseDoc);
    expect(post.updatedAt).toBe("2026-03-15T09:30:00.000Z");
  });

  it("reports a genuine edit as distinct from the publish date", () => {
    // The actual bug: dateModified === datePublished for every post, always.
    // Here they differ, which is the real-world case an edited post produces.
    const post = toPublicPost(baseDoc);
    expect(post.updatedAt).not.toBe(post.date);
  });

  it("still reports the publish date itself unchanged", () => {
    const post = toPublicPost(baseDoc);
    expect(post.date).toBe("2026-01-01");
  });
});
