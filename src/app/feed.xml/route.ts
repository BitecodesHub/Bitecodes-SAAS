import { buildFeed } from "@/lib/feed";
import { getPublishedPosts } from "@/lib/server/blog/repository";
import { siteConfig } from "@/lib/site";

// RSS 2.0 alias of /rss.xml for readers that look for /feed.xml by default.
export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await getPublishedPosts();
  const xml = buildFeed({
    format: "rss",
    selfHref: `${siteConfig.url}/feed.xml`,
    posts,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
