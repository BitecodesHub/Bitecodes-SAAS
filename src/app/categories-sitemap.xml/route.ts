import { loc, xmlResponse, nowIso } from "@/lib/sitemap-xml";

// Categories sitemap. There are NO dedicated category pages in this repo
// (no /services/category/<slug>, no /industries/[slug] route). The four
// serviceCategories are display labels with spaces, NOT URL slugs. So we list
// ONLY the real hub URLs that resolve: /services and /industries. Do not
// invent category detail pages here — append real <loc> entries when such
// pages ship.
export const dynamic = "force-static";

export function GET(): Response {
  const lastmod = nowIso();
  const hubs = [
    { path: "/services", priority: "0.9" },
    { path: "/industries", priority: "0.7" },
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
