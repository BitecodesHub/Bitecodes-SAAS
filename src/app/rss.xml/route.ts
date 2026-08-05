import { buildFeed } from "@/lib/feed";
import { getPublishedPosts } from "@/lib/server/blog/repository";
import { siteConfig } from "@/lib/site";

// Regenerated on demand (revalidated when a post publishes) so AI-published
// posts appear in the feed without a redeploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await getPublishedPosts();
  const xml = buildFeed({
    format: "rss",
    selfHref: `${siteConfig.url}/rss.xml`,
    posts,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
