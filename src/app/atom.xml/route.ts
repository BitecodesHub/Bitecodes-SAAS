import { buildFeed } from "@/lib/feed";
import { getPublishedPosts } from "@/lib/server/blog/repository";
import { siteConfig } from "@/lib/site";

// Atom 1.0 feed, regenerated on demand so new posts appear without a redeploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await getPublishedPosts();
  const xml = buildFeed({
    format: "atom",
    selfHref: `${siteConfig.url}/atom.xml`,
    posts,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
