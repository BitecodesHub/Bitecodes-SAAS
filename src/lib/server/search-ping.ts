import "server-only";

import { getIndexNowKey, getSiteUrl } from "@/lib/server/env";
import {
  clearSearchFailures,
  recordSearchFailures,
} from "@/lib/server/search-submissions";

/**
 * Tells search engines a set of URLs changed, via IndexNow (Bing, Yandex, and
 * others share the protocol). A no-op when `INDEXNOW_KEY` is unset, so the
 * caller never has to check first.
 *
 * Best-effort by design: a failed ping must never fail the publish that
 * triggered it. Google does not use IndexNow, but it rediscovers new URLs
 * from the sitemap, which already lists published posts. A failure is not
 * discarded, though: it is recorded in `search_submissions` so the daily ping
 * retries it with backoff, and cleared once a later attempt is accepted.
 */
export async function pingIndexNow(paths: string[]): Promise<boolean> {
  const key = getIndexNowKey();
  if (!key || paths.length === 0) return false;

  const origin = getSiteUrl();
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }

  const urlList = paths.map((p) =>
    p.startsWith("http") ? p : `${origin}${p.startsWith("/") ? "" : "/"}${p}`,
  );

  const failed = async (error: string): Promise<false> => {
    try {
      await recordSearchFailures(paths, new Date(), error);
    } catch (recordError) {
      // The submission itself already failed; a second failure must not escape
      // into the publish action. Log it so the broken queue is visible.
      console.warn(
        "[search-ping] Could not record the failed IndexNow submission:",
        recordError,
      );
    }
    return false;
  };

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        // Fixed path served by src/app/indexnow.txt/route.ts.
        keyLocation: `${origin}/indexnow.txt`,
        urlList,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return failed(`IndexNow responded with HTTP ${response.status}.`);
    }

    try {
      await clearSearchFailures(paths);
    } catch (clearError) {
      // The URLs were accepted; stale retry rows only cause a harmless repeat
      // submission, so this must not turn a success into a failure.
      console.warn(
        "[search-ping] Could not clear accepted IndexNow submissions:",
        clearError,
      );
    }
    return true;
  } catch (error) {
    return failed(
      error instanceof Error ? error.message : "IndexNow request failed.",
    );
  }
}
