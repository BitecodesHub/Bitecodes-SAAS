import { buildFeed } from "@/lib/feed";
import { siteConfig } from "@/lib/site";

// Atom 1.0 feed, generated at build time.
export const dynamic = "force-static";

export function GET() {
  const xml = buildFeed({
    format: "atom",
    selfHref: `${siteConfig.url}/atom.xml`,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
