import { getPublishedPosts } from "@/lib/server/blog/repository";
import { loc, xmlEscape, xmlResponse } from "@/lib/sitemap-xml";

// Google News sitemap. Google requires entries to be articles published in
// the last two days. Dynamic, and backed by the merged published set, so an
// AI-published post appears here without a redeploy — the previous version
// read the static data file at build time and could never list a database post.
export const dynamic = "force-dynamic";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<Response> {
  const cutoff = Date.now() - TWO_DAYS_MS;
  const posts = await getPublishedPosts();
  const recent = posts.filter((p) => {
    const published = Date.parse(p.date);
    return Number.isFinite(published) && published >= cutoff;
  });

  const entries = recent
    .map(
      (p) =>
        `  <url>
    <loc>${loc(`/blog/${p.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape("Bitecodes")}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(p.date).toISOString()}</news:publication_date>
      <news:title>${xmlEscape(p.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>
`;

  return xmlResponse(body);
}
