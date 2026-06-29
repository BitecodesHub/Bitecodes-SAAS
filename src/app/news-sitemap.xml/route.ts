import { blogPosts } from "@/data/blog";
import { loc, xmlEscape, xmlResponse } from "@/lib/sitemap-xml";

// Google News sitemap. Google requires entries to be articles published in
// the LAST TWO DAYS. All current posts (2026-05-28 and earlier) are older
// than that as of 2026-06-29, so this renders a VALID EMPTY <urlset> with the
// news namespace declared. It auto-populates the moment a post <2 days old
// is added to src/data/blog.ts and the site is rebuilt — no code change needed.
export const dynamic = "force-static";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function GET(): Response {
  const cutoff = Date.now() - TWO_DAYS_MS;
  const recent = blogPosts.filter((p) => Date.parse(p.date) >= cutoff);

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
