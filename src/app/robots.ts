import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

// AI answer-engine crawlers we explicitly welcome (GEO / AI-search ranking).
const aiBots = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everything public is crawlable. Private, tokenized, and noindex routes
      // are intentionally NOT disallowed here: a crawler must be able to fetch
      // a URL to see its `noindex` (meta tag or X-Robots-Tag). Blocking them in
      // robots.txt would hide that instruction and allow a linked URL to be
      // indexed as a bare address. next.config.ts carries the noindex headers.
      { userAgent: "*", allow: "/" },
      // Explicitly allow AI crawlers full access so the site is eligible to be
      // indexed and cited by generative answer engines.
      { userAgent: aiBots, allow: "/" },
    ],
    // Point at the sitemap index so crawlers discover the
    // news/image/video sub-sitemaps from one entry.
    sitemap: `${siteConfig.url}/sitemap-index.xml`,
    host: siteConfig.url,
  };
}
