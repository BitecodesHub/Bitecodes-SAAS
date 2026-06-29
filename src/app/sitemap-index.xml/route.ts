import { xmlResponse, nowIso, loc } from "@/lib/sitemap-xml";

// Sitemap index — the single entry point Google and AI crawlers read.
// robots.ts points here (not /sitemap.xml). /sitemap.xml is still produced by
// src/app/sitemap.ts and listed as the first child below.
export const dynamic = "force-static";

export function GET(): Response {
  const lastmod = nowIso();
  const sitemaps = [
    "/sitemap.xml",
    "/news-sitemap.xml",
    "/image-sitemap.xml",
    "/video-sitemap.xml",
    "/products-sitemap.xml",
    "/categories-sitemap.xml",
    "/tags-sitemap.xml",
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (p) =>
      `  <sitemap>\n    <loc>${loc(p)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>
`;

  return xmlResponse(body);
}
