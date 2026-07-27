import { renderOgImage, OG_SIZE } from "@/lib/og";
import { blogPosts, getPost } from "@/data/blog";

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
  const post = getPost(slug);
  return renderOgImage({
    eyebrow: post?.category ?? "Blog",
    title: post?.title ?? "Article",
    subtitle: post?.excerpt,
  });
}
