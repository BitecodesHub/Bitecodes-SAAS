import type { ProspectSignals } from "@/lib/server/db/types";

/**
 * Reads commercial signals out of a business homepage.
 *
 * The existing website auditor (`src/lib/server/website-auditor.ts`) already
 * answers "is this page well built?" — titles, headers, alt text, security
 * headers. This module answers the different question outreach actually needs:
 * *what can this business not do today?* A restaurant with no booking widget and
 * a bakery with no cart are both "fine" by audit standards and both leaving
 * money on the table.
 *
 * Pure: it takes the HTML and headers the auditor already fetched and returns a
 * verdict, so no extra request is made and the whole surface is unit-testable.
 *
 * Every pattern here is a linear-time regular expression over a bounded string.
 * The HTML is attacker-controlled, so nested quantifiers — the shape that causes
 * catastrophic backtracking — are avoided deliberately.
 */

export interface SignalInput {
  html: string;
  /** Response headers, keys already lowercased. */
  headers?: Record<string, string | string[] | undefined>;
  finalUrl?: string;
  responseTimeMs?: number | null;
  htmlBytes?: number | null;
}

/** Signals for a site that could not be reached at all. */
export function unreachableSignals(): ProspectSignals {
  return {
    reachable: false,
    https: false,
    responsive: false,
    responseTimeMs: null,
    htmlBytes: null,
    hasStructuredData: false,
    hasFavicon: false,
    hasOpenGraph: false,
    hasAnalytics: false,
    hasBooking: false,
    hasEcommerce: false,
    hasChat: false,
    hasBlog: false,
    hasContactForm: false,
    hasSocialLinks: false,
    platform: null,
    copyrightYear: null,
  };
}

const ANALYTICS_PATTERNS = [
  "googletagmanager.com",
  "google-analytics.com",
  "gtag(",
  "plausible.io",
  "usefathom.com",
  "matomo",
  "piwik",
  "umami",
  "clarity.ms",
  "hotjar",
  "mixpanel",
  "cdn.segment.com",
  "posthog",
  "statcounter",
];

const BOOKING_PATTERNS = [
  "calendly.com",
  "opentable.com",
  "resy.com",
  "setmore.com",
  "acuityscheduling",
  "simplybook",
  "booksy.com",
  "fresha.com",
  "zocdoc.com",
  "practo.com",
  "squareup.com/appointments",
  "cal.com",
  "youcanbook.me",
  "bookeo",
  "mindbodyonline",
  "tablein",
  "eatapp.co",
  "dineplan",
  "book-a-table",
  "book-now",
  "book-appointment",
  "book-online",
  "bookonline",
  "book an appointment",
  "book a table",
  "make a reservation",
  "schedule a visit",
];

const ECOMMERCE_PATTERNS = [
  "cdn.shopify.com",
  "shopify.theme",
  "woocommerce",
  "wp-content/plugins/woocommerce",
  "snipcart",
  "bigcommerce",
  "magento",
  "opencart",
  "prestashop",
  "add to cart",
  "add-to-cart",
  "addtocart",
  "/cart",
  "checkout.stripe.com",
  "js.stripe.com",
  "checkout.razorpay.com",
  "paypal.com/sdk",
  "instamojo",
  "gumroad.com",
  "lemonsqueezy",
];

const CHAT_PATTERNS = [
  "tawk.to",
  "intercom.io",
  "intercomcdn",
  "crisp.chat",
  "drift.com",
  "livechatinc",
  "zdassets.com",
  "zendesk.com/embeddable",
  "freshchat",
  "tidio",
  "chatway",
  "smartsupp",
  "wa.me/",
  "api.whatsapp.com/send",
  "web.whatsapp.com/send",
];

const SOCIAL_PATTERNS = [
  "facebook.com/",
  "instagram.com/",
  "twitter.com/",
  "x.com/",
  "linkedin.com/",
  "youtube.com/",
  "youtu.be/",
  "tiktok.com/",
  "pinterest.com/",
];

/**
 * Platform fingerprints, most specific first.
 *
 * The label is the sales-relevant fact, not trivia: "Wix" and "GoDaddy Website
 * Builder" mean a locked-in template with no export path, which is a concrete
 * migration pitch. "Next.js" means the business already has a developer, so the
 * pitch is features rather than a rebuild.
 */
const PLATFORM_FINGERPRINTS: Array<{ label: string; patterns: string[] }> = [
  { label: "Shopify", patterns: ["cdn.shopify.com", "shopify.theme"] },
  {
    label: "Wix",
    patterns: ["static.parastorage.com", "wix.com", "wixstatic.com"],
  },
  {
    label: "Squarespace",
    patterns: ["static1.squarespace.com", "squarespace.com"],
  },
  { label: "Webflow", patterns: ["webflow.io", "webflow.js", "wf-domain"] },
  {
    label: "GoDaddy Website Builder",
    patterns: ["godaddysites.com", "img1.wsimg.com"],
  },
  { label: "Weebly", patterns: ["weebly.com", "editmysite.com"] },
  { label: "WooCommerce", patterns: ["woocommerce"] },
  { label: "WordPress", patterns: ["wp-content", "wp-includes", "wp-json"] },
  { label: "Joomla", patterns: ["/media/jui/", "joomla"] },
  { label: "Drupal", patterns: ["drupal.js", "/sites/default/files"] },
  { label: "Magento", patterns: ["magento", "mage/cookies"] },
  { label: "HubSpot CMS", patterns: ["hs-scripts.com", "hubspot"] },
  { label: "Blogger", patterns: ["blogspot.com", "blogger.com"] },
  { label: "Framer", patterns: ["framerusercontent.com"] },
  { label: "Carrd", patterns: ["carrd.co"] },
  { label: "Next.js", patterns: ["__next_data__", "/_next/static"] },
  { label: "Nuxt", patterns: ["__nuxt__", "/_nuxt/"] },
  { label: "Gatsby", patterns: ["___gatsby", "gatsby-"] },
  { label: "Angular", patterns: ["ng-version"] },
  { label: "React", patterns: ["data-reactroot", "react-dom"] },
];

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Detects a mobile viewport declaration.
 *
 * Attribute order varies, so each `<meta>` tag is inspected individually rather
 * than matched with one wide pattern that would also accept
 * `<meta name="description" content="width=device-width">`.
 */
export function detectResponsive(html: string): boolean {
  const metas = html.match(/<meta\b[^>]*>/gi);
  if (!metas) return false;

  return metas.some((meta) => {
    if (!/\bname\s*=\s*["']?viewport["']?/i.test(meta)) return false;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(meta)?.[1] ?? "";
    return /width\s*=\s*device-width/i.test(content);
  });
}

/**
 * Detects a working contact form.
 *
 * A bare `<form>` is not enough — search boxes and newsletter widgets are forms
 * too. It must also carry an email field or a message box, which is what a real
 * enquiry form has.
 */
export function detectContactForm(html: string): boolean {
  if (!/<form\b/i.test(html)) return false;
  return (
    /<input\b[^>]*type\s*=\s*["']?email["']?/i.test(html) ||
    /<textarea\b/i.test(html) ||
    /<form\b[^>]*action\s*=\s*["'][^"']*contact/i.test(html) ||
    /<input\b[^>]*name\s*=\s*["']?(email|e-mail|your-email)["']?/i.test(html)
  );
}

/**
 * Detects a blog or news section from navigation links.
 *
 * Anchored to a path boundary so `/blogger-outreach` or a `?news=1` query does
 * not count, and the word must appear in an `href`, not in body copy.
 */
export function detectBlog(html: string): boolean {
  return /href\s*=\s*["'][^"']*\/(blog|news|articles|insights|stories)(\/|["'#?])/i.test(
    html,
  );
}

/**
 * The most recent plausible copyright year on the page.
 *
 * Used as a staleness proxy: a footer reading "© 2016" is the single most
 * legible sign that nobody has touched the site in years, and it is a fact the
 * owner can verify instantly when it appears in an outreach email.
 */
export function detectCopyrightYear(html: string): number | null {
  const currentYear = new Date().getUTCFullYear();
  // The trailing group captures the end of a range: "© 2015-2026" is a site
  // maintained through 2026, so reading the first year would wrongly brand it
  // stale — the opposite of the conclusion the footer supports.
  const pattern =
    /(?:©|&copy;|&#169;|copyright)[^0-9<]{0,40}((?:19|20)\d{2})(?:\s*(?:-|–|—|&ndash;|&mdash;|to)\s*((?:19|20)\d{2}))?/gi;
  let best: number | null = null;

  for (const match of html.matchAll(pattern)) {
    for (const captured of [match[2], match[1]]) {
      if (!captured) continue;
      const year = Number(captured);
      // A year in the future is a template placeholder, not a real date.
      if (year < 1995 || year > currentYear) continue;
      if (best === null || year > best) best = year;
      break;
    }
  }

  return best;
}

export function detectPlatform(lowerHtml: string): string | null {
  for (const { label, patterns } of PLATFORM_FINGERPRINTS) {
    if (includesAny(lowerHtml, patterns)) return label;
  }
  return null;
}

/**
 * Extracts every signal from one fetched page.
 *
 * `htmlBytes` is passed in rather than measured from the string because the
 * auditor truncates its buffer at 1 MB — measuring here would report the
 * truncated length and make a bloated page look lean.
 */
export function extractSignals({
  html,
  headers = {},
  finalUrl,
  responseTimeMs = null,
  htmlBytes = null,
}: SignalInput): ProspectSignals {
  const lower = html.toLowerCase();
  const https = finalUrl ? finalUrl.startsWith("https://") : false;

  // A CSP or HSTS header is a hint the site is maintained, but the generator
  // header is the reliable platform tell when present.
  const generator = String(headers["x-generator"] ?? headers.generator ?? "")
    .toLowerCase()
    .trim();

  return {
    reachable: true,
    https,
    responsive: detectResponsive(html),
    responseTimeMs,
    htmlBytes,
    hasStructuredData:
      lower.includes("application/ld+json") ||
      /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html),
    hasFavicon: /<link\b[^>]*rel\s*=\s*["'][^"']*icon/i.test(html),
    hasOpenGraph: /(?:property|name)\s*=\s*["']og:/i.test(html),
    hasAnalytics: includesAny(lower, ANALYTICS_PATTERNS),
    hasBooking: includesAny(lower, BOOKING_PATTERNS),
    hasEcommerce: includesAny(lower, ECOMMERCE_PATTERNS),
    hasChat: includesAny(lower, CHAT_PATTERNS),
    hasBlog: detectBlog(html),
    hasContactForm: detectContactForm(html),
    hasSocialLinks: includesAny(lower, SOCIAL_PATTERNS),
    platform: detectPlatform(lower) ?? platformFromGenerator(generator),
    copyrightYear: detectCopyrightYear(html),
  };
}

function platformFromGenerator(generator: string): string | null {
  if (!generator) return null;
  for (const { label } of PLATFORM_FINGERPRINTS) {
    if (generator.includes(label.toLowerCase())) return label;
  }
  // Keep an unrecognised generator string — it is still useful intelligence.
  return generator.slice(0, 60) || null;
}
