/**
 * Sanitises the post-sign-in destination.
 *
 * Its own module because `actions.ts` carries `"use server"`, where every export
 * must be an async function — and because this is security-critical enough to
 * want a direct unit test rather than a copy of the rules in a test file.
 *
 * Without this, `next` is an open redirect: a link to
 * `/admin/login?next=https://evil.example` would bounce a freshly-authenticated
 * operator off-site, which is a credible phishing setup against exactly the
 * person whose credentials are worth the most.
 */
export function safeNextPath(next: string | undefined | null): string {
  const fallback = "/admin";
  if (!next) return fallback;

  // Reject absolute and protocol-relative URLs. "//evil.example" is a fully
  // valid absolute URL as far as a browser is concerned.
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;

  // Some user agents normalise a backslash to a forward slash, so "/\evil.com"
  // can become "//evil.com" after this check would otherwise have passed.
  if (next.includes("\\")) return fallback;

  // Confine to the admin area. Anchored on the segment boundary so
  // "/adminx/evil" does not slip through on a bare prefix match.
  if (
    next !== "/admin" &&
    !next.startsWith("/admin/") &&
    !next.startsWith("/admin?")
  ) {
    return fallback;
  }

  return next;
}
