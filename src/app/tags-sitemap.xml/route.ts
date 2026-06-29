import { loc, xmlResponse, nowIso } from "@/lib/sitemap-xml";

// Tags sitemap. There are NO /blog/tag/<tag> or /technologies/<slug> pages
// in this repo (verified: src/app/blog has no tag folder; src/app/technologies
// has no [slug] subfolder). blog tags and technology slugs are NOT real URLs.
// So we list ONLY the real hub URLs that resolve: /blog and /technologies.
// Append real <loc> entries when tag/tech detail pages ship.
export const dynamic = "force-static";

export function GET(): Response {
  const lastmod = nowIso();
  const hubs = [
    { path: "/blog", priority: "0.7" },
    { path: "/technologies", priority: "0.7" },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${hubs
  .map(
    (h) =>
      `  <url>\n    <loc>${loc(h.path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${h.priority}</priority>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return xmlResponse(body);
}
