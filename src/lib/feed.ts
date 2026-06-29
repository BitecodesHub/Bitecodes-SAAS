import { siteConfig } from "@/lib/site";
import { blogPosts } from "@/data/blog";

/**
 * Shared feed generator for RSS 2.0 and Atom 1.0.
 *
 * Single source of truth for the blog feeds. Both rss.xml / feed.xml
 * (RSS 2.0) and atom.xml (Atom 1.0) are produced from the same validated
 * post list so they can never drift from src/data/blog.ts.
 */

const BASE = siteConfig.url.replace(/\/$/, "");
export const BLOG_URL = `${BASE}/blog`;

/** XML-escape text content and attribute values. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822 date for RSS <pubDate> / <lastBuildDate>. */
function toRFC822(dateIso: string): string {
  // noon UTC avoids any day-boundary / timezone off-by-one.
  return new Date(`${dateIso}T12:00:00Z`).toUTCString();
}

/** ISO 8601 with time for Atom <updated> / <published>. */
function toISO8601(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00Z`).toISOString();
}

function postUrl(slug: string): string {
  return `${BLOG_URL}/${slug}`;
}

/** Throw if a date string is not parseable. */
function assertDate(dateIso: string, slug: string): void {
  const d = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date "${dateIso}" for blog post "${slug}"`);
  }
}

/** Throw if a URL is not an absolute bitecodes.com URL. */
function assertAbsolute(url: string): void {
  if (!/^https:\/\/bitecodes\.com(\/|$)/.test(url)) {
    throw new Error(
      `Expected absolute https://bitecodes.com URL, got "${url}"`,
    );
  }
}

export type FeedFormat = "rss" | "atom";

export interface FeedOptions {
  format: FeedFormat;
  /** Absolute self link of this feed, e.g. https://bitecodes.com/rss.xml */
  selfHref: string;
}

/** Most recent post date as ISO 8601 (feed <updated> / RSS lastBuildDate). */
function feedUpdatedIso(): string {
  const times = blogPosts.map((p) => new Date(`${p.date}T12:00:00Z`).getTime());
  const latest = times.length ? Math.max(...times) : Date.now();
  return new Date(latest).toISOString();
}

/** Sorted (newest-first) + validated copy of blog posts. */
function validatedPosts() {
  const posts = [...blogPosts].sort(
    (a, b) =>
      new Date(`${b.date}T12:00:00Z`).getTime() -
      new Date(`${a.date}T12:00:00Z`).getTime(),
  );
  for (const p of posts) {
    assertDate(p.date, p.slug);
    assertAbsolute(postUrl(p.slug));
  }
  return posts;
}

/** Build the feed XML string for the requested format. */
export function buildFeed(opts: FeedOptions): string {
  assertAbsolute(opts.selfHref);
  const updated = feedUpdatedIso();
  const posts = validatedPosts();
  return opts.format === "rss"
    ? buildRss(opts.selfHref, updated, posts)
    : buildAtom(opts.selfHref, updated, posts);
}

function buildRss(
  selfHref: string,
  updatedIso: string,
  posts: ReturnType<typeof validatedPosts>,
): string {
  const channel = [
    `    <title>${xmlEscape(siteConfig.name)} Blog</title>`,
    `    <link>${BLOG_URL}</link>`,
    `    <description>${xmlEscape(siteConfig.description)}</description>`,
    `    <language>en</language>`,
    `    <lastBuildDate>${new Date(updatedIso).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${xmlEscape(selfHref)}" rel="self" type="application/rss+xml" />`,
  ].join("\n");

  const items = posts
    .map((p) => {
      const url = postUrl(p.slug);
      return [
        "    <item>",
        `      <title>${xmlEscape(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${toRFC822(p.date)}</pubDate>`,
        `      <description>${xmlEscape(p.excerpt)}</description>`,
        `      <category>${xmlEscape(p.category)}</category>`,
        `      <author>hello@bitecodes.com (${xmlEscape(p.author)})</author>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
${channel}
${items}
  </channel>
</rss>`;
}

function buildAtom(
  selfHref: string,
  updatedIso: string,
  posts: ReturnType<typeof validatedPosts>,
): string {
  const head = [
    `  <title>${xmlEscape(siteConfig.name)} Blog</title>`,
    `  <link href="${BLOG_URL}" />`,
    `  <link href="${xmlEscape(selfHref)}" rel="self" type="application/atom+xml" />`,
    `  <id>${BLOG_URL}</id>`,
    `  <updated>${updatedIso}</updated>`,
    `  <subtitle>${xmlEscape(siteConfig.description)}</subtitle>`,
    `  <author><name>${xmlEscape(siteConfig.founder)}</name></author>`,
  ].join("\n");

  const entries = posts
    .map((p) => {
      const url = postUrl(p.slug);
      const iso = toISO8601(p.date);
      return [
        "  <entry>",
        `    <title>${xmlEscape(p.title)}</title>`,
        `    <link href="${url}" />`,
        `    <id>${url}</id>`,
        `    <published>${iso}</published>`,
        `    <updated>${iso}</updated>`,
        `    <summary>${xmlEscape(p.excerpt)}</summary>`,
        `    <author><name>${xmlEscape(p.author)}</name></author>`,
        `    <category term="${xmlEscape(p.category)}" />`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
${head}
${entries}
</feed>`;
}
