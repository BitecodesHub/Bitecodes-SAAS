import { services } from "@/data/services";
import { blogPosts } from "@/data/blog";
import { projects } from "@/data/projects";
import { loc, xmlResponse, nowIso } from "@/lib/sitemap-xml";

// Image sitemap. Only references OG image routes that actually resolve in
// this repo: /opengraph-image (home), /services/[slug]/opengraph-image,
// /blog/[slug]/opengraph-image, /portfolio/[slug]/opengraph-image. There are
// NO hub OG images for /services, /portfolio, /industries, /technologies,
// or /blog — do not invent them. The logo (/icon.svg) and apple-touch icon
// are attached to the home page entry.
export const dynamic = "force-static";

type ImgEntry = { page: string; images: string[] };

export function GET(): Response {
  const lastmod = nowIso();
  const entries: ImgEntry[] = [
    {
      page: "/",
      images: [
        loc("/opengraph-image"),
        loc("/icon.svg"),
        loc("/apple-touch-icon.png"),
      ],
    },
    ...services.map((s) => ({
      page: `/services/${s.slug}`,
      images: [loc(`/services/${s.slug}/opengraph-image`)],
    })),
    ...blogPosts.map((p) => ({
      page: `/blog/${p.slug}`,
      images: [loc(`/blog/${p.slug}/opengraph-image`)],
    })),
    ...projects.map((p) => ({
      page: `/portfolio/${p.slug}`,
      images: [loc(`/portfolio/${p.slug}/opengraph-image`)],
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    (e) =>
      `  <url>\n    <loc>${loc(e.page)}</loc>\n    <lastmod>${lastmod}</lastmod>\n${e.images
        .map(
          (i) =>
            `    <image:image>\n      <image:loc>${i}</image:loc>\n    </image:image>`,
        )
        .join("\n")}\n  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return xmlResponse(body);
}
