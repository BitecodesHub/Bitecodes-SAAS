import { renderOgImage, OG_SIZE } from "@/lib/og";
import { blogPosts } from "@/data/blog";
import { getPublishedPost } from "@/lib/server/blog/repository";

// Dynamic so AI-published posts get a titled card, not the generic fallback.
export const dynamic = "force-dynamic";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bitecodes article";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  return renderOgImage({
    eyebrow: post?.category ?? "Blog",
    title: post?.title ?? "Article",
    subtitle: post?.excerpt,
  });
}
