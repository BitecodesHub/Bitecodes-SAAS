import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/types/content";

vi.mock("@/lib/server/blog/repository", () => ({
  getPublishedPosts: vi.fn(),
}));

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { GET as sitemapIndexGet } from "@/app/sitemap-index.xml/route";
import { GET as newsSitemapGet } from "@/app/news-sitemap.xml/route";
import { GET as imageSitemapGet } from "@/app/image-sitemap.xml/route";
import { getPublishedPosts } from "@/lib/server/blog/repository";
import { siteConfig } from "@/lib/site";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: "database-post",
    title: "A database post",
    excerpt: "Excerpt",
    category: "Engineering",
    tags: ["nextjs"],
    author: "Bitecodes",
    date: new Date(Date.now() - HOUR_MS).toISOString(),
    readingMinutes: 4,
    body: [],
    featured: false,
    metaDescription: "Meta",
    faq: [],
    internalLinks: [],
    aiAssisted: true,
    updatedAt: null,
    ...overrides,
  } as BlogPost;
}

describe("public sitemap", () => {
  beforeEach(() => {
    vi.mocked(getPublishedPosts).mockResolvedValue([]);
  });

  it("lists real canonical pages and omits redirects, 404s, and noindex pages", async () => {
    const urls = (await sitemap()).map((entry) => {
      return new URL(entry.url).pathname;
    });

    expect(urls).toContain("/booking");
    expect(urls).not.toContain("/book-a-call");
    expect(urls).not.toContain("/referral");
    expect(urls).not.toContain("/thank-you");
    expect(urls).not.toContain("/maintenance");
    expect(urls).not.toContain("/offline");
  });

  it("includes each database post once and does not invent a modified time for static pages", async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([post()]);
    const entries = await sitemap();

    expect(
      entries.filter((entry) => entry.url.endsWith("/blog/database-post")),
    ).toHaveLength(1);
    expect(
      entries.find((entry) => entry.url === `${siteConfig.url}/pricing`)
        ?.lastModified,
    ).toBeUndefined();
  });
});

describe("specialised sitemaps", () => {
  it("lists only database posts published in the last two days", async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([
      post({
        slug: "fresh",
        date: new Date(Date.now() - HOUR_MS).toISOString(),
      }),
      post({
        slug: "stale",
        date: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      }),
    ]);

    const xml = await (await newsSitemapGet()).text();

    expect(xml).toContain("/blog/fresh");
    expect(xml).not.toContain("/blog/stale");
  });

  it("references the OG image route for every database post", async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([post({ slug: "fresh" })]);

    const xml = await (await imageSitemapGet()).text();

    expect(xml).toContain("/blog/fresh/opengraph-image");
  });

  it("advertises no duplicate child sitemaps", async () => {
    const xml = await (await sitemapIndexGet()).text();
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );

    expect(locations).toEqual([
      "/sitemap.xml",
      "/news-sitemap.xml",
      "/image-sitemap.xml",
      "/video-sitemap.xml",
    ]);
  });
});

describe("robots", () => {
  it("points at the sitemap index and does not hide noindex pages from crawlers", () => {
    const rules = robots();

    expect(rules.sitemap).toBe(`${siteConfig.url}/sitemap-index.xml`);
    expect(JSON.stringify(rules.rules)).not.toContain("/thank-you");
  });
});
