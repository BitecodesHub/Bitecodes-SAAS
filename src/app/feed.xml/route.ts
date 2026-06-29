import { buildFeed } from "@/lib/feed";
import { siteConfig } from "@/lib/site";

// RSS 2.0 alias of /rss.xml for readers that look for /feed.xml by default.
export const dynamic = "force-static";

export function GET() {
  const xml = buildFeed({
    format: "rss",
    selfHref: `${siteConfig.url}/feed.xml`,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
