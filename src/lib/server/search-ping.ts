import "server-only";

import { getIndexNowKey, getSiteUrl } from "@/lib/server/env";

/**
 * Tells search engines a set of URLs changed, via IndexNow (Bing, Yandex, and
 * others share the protocol). A no-op when `INDEXNOW_KEY` is unset, so the
 * caller never has to check first.
 *
 * Best-effort by design: a failed ping must never fail the publish that
 * triggered it. Google does not use IndexNow, but it rediscovers new URLs
 * from the sitemap, which already lists published posts.
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
    return response.ok;
  } catch {
    return false;
  }
}
