import "server-only";

import type { DigestRange, DigestSection } from "@/lib/server/digest/types";
import { blogPostDocs } from "@/lib/server/db/collections";
import type { BlogPostDoc } from "@/lib/server/db/types";
import { EmailBlock } from "@/lib/email/template";

/**
 * Digest section "content": Blog drafts awaiting review.
 *
 * Owned by the content-engine package. Returns a single DigestSection
 * summarising draft blog posts, or null when there is nothing to report.
 */
export async function buildSection(
  _range: DigestRange,
): Promise<DigestSection | null> {
  const collection = await blogPostDocs();
  const blogPostsSnap = await collection
    .find<BlogPostDoc>({ status: "draft" })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  if (blogPostsSnap.length === 0) {
    return null;
  }

  const blocks: EmailBlock[] = blogPostsSnap.map((post) => ({
    type: "h2",
    text: post.title,
  }));

  for (const post of blogPostsSnap) {
    blocks.push({
      type: "p",
      text: post.excerpt,
    });
  }

  return {
    id: "content",
    title: "Content Drafts",
    summary: `${blogPostsSnap.length} blog post(s) awaiting review`,
    metrics: [{ label: "Posts", value: blogPostsSnap.length.toString() }],
    blocks,
  };
}
