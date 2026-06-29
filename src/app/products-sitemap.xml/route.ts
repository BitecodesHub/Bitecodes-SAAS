import { services } from "@/data/services";
import { loc, xmlResponse, nowIso } from "@/lib/sitemap-xml";

// Products sitemap. For a services studio, the "products" are the service
// offerings -> /services/<slug>. Maps over the services array (19 slugs in
// src/data/services.ts today).
export const dynamic = "force-static";

export function GET(): Response {
  const lastmod = nowIso();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${services
  .map(
    (s) =>
      `  <url>\n    <loc>${loc(`/services/${s.slug}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return xmlResponse(body);
}
