import "server-only";

import { getPublishedPosts } from "@/lib/server/blog/repository";
import { getIndexNowKey } from "@/lib/server/env";
import { pingIndexNow } from "@/lib/server/search-ping";
import { getSettings } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";
import type { BlogPost } from "@/types/content";

/**
 * `search.ping` — Tells IndexNow which pages changed since the last run.
 *
 * Daily, for blog posts published or updated in the last 26 hours. On Mondays
 * the key static pages are added, so changes to a landing page that has no
 * publish timestamp still reach Bing and the other IndexNow participants.
 *
 * No state is written: IndexNow submissions are idempotent, and re-pinging a
 * URL is harmless. Google ignores IndexNow and rediscovers the same URLs from
 * the sitemap.
 */

/** One hour of overlap covers a late cron run without widening the window much. */
const CHANGE_WINDOW_MS = 26 * 60 * 60 * 1000;

/** Static pages worth re-submitting every Monday. */
export const KEY_STATIC_PATHS = [
  "/",
  "/services",
  "/pricing",
  "/contact",
  "/website-audit",
  "/about",
  "/portfolio",
  "/blog",
] as const;

/**
 * Paths to ping for a given run.
 *
 * Kept pure so the window and the Monday rule can be tested without a
 * database, a clock, or the network.
 */
export function selectSearchPingPaths(
  posts: Pick<BlogPost, "slug" | "date" | "updatedAt">[],
  now: Date,
): string[] {
  const cutoff = now.getTime() - CHANGE_WINDOW_MS;
  const paths = new Set<string>();

  for (const post of posts) {
    // Static posts have no independent modification time; their publish date
    // is the only timestamp the site actually knows.
    const changedAt = Date.parse(post.updatedAt ?? post.date);
    if (Number.isFinite(changedAt) && changedAt >= cutoff) {
      paths.add(`/blog/${post.slug}`);
    }
  }

  if (now.getUTCDay() === 1) {
    for (const path of KEY_STATIC_PATHS) paths.add(path);
  }

  return [...paths];
}

export async function handleSearchPing(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettings();
  if (!settings.growth.searchPing) {
    context.log("Search-engine ping is switched off.");
    return { skipped: "disabled" };
  }

  if (!getIndexNowKey()) {
    context.log("INDEXNOW_KEY is not set; skipping the ping.");
    return { skipped: "no-key" };
  }

  if (Date.now() > context.deadline - 5_000) {
    context.log("Not enough time left to ping search engines.");
    return { skipped: "deadline" };
  }

  const now = new Date();
  const posts = await getPublishedPosts();
  const paths = selectSearchPingPaths(posts, now);

  if (paths.length === 0) {
    context.log("No pages changed in the last 26 hours.");
    return { pinged: false, count: 0, paths: [] };
  }

  const pinged = await pingIndexNow(paths);
  context.log(
    pinged
      ? `Submitted ${paths.length} URL${paths.length === 1 ? "" : "s"} to IndexNow.`
      : `IndexNow did not accept the submission for ${paths.length} URL${paths.length === 1 ? "" : "s"}.`,
  );

  return { pinged, count: paths.length, paths };
}
