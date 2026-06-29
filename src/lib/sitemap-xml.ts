import { siteConfig } from "@/lib/site";

// Shared helpers for the specialized sitemap route handlers.
// Every text value written into a sitemap MUST go through xmlEscape —
// service/category names contain '&' (e.g. "Cloud & Operations") which
// would otherwise produce invalid XML that Google rejects.

export const BASE = siteConfig.url; // https://bitecodes.com

/** Escape a string for safe inclusion in XML text/attribute nodes. */
export function xmlEscape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build a fully-escaped absolute <loc> from a site-relative path. */
export function loc(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Common headers + cache for a static, edge-cacheable XML response. */
export const xmlResponseInit: ResponseInit = {
  headers: {
    "Content-Type": "application/xml; charset=utf-8",
    // Built once (force-static), cached aggressively at every layer.
    "Cache-Control":
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
  },
};

/** ISO 8601 lastmod for "now" (re-evaluated at build time). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Wrap a finished XML document string into a Response. */
export function xmlResponse(body: string): Response {
  return new Response(body, xmlResponseInit);
}
