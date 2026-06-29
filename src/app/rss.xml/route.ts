import { buildFeed } from "@/lib/feed";
import { siteConfig } from "@/lib/site";

// Generated at build time — feeds only change when src/data/blog.ts changes.
export const dynamic = "force-static";

export function GET() {
  const xml = buildFeed({
    format: "rss",
    selfHref: `${siteConfig.url}/rss.xml`,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
