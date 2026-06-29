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
      { userAgent: "*", allow: "/", disallow: ["/thank-you"] },
      // Explicitly allow AI crawlers full access so the site is eligible to be
      // indexed and cited by generative answer engines.
      { userAgent: aiBots, allow: "/" },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
