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
 *
 * There are two signed-in areas — `/admin` for staff and `/app` for self-serve
 * customers — and a destination is confined to the one being signed in to. That
 * is not merely tidy: a customer arriving at `/admin` is refused, and a staff
 * member arriving at `/app` is shown a customer's dashboard for an account with
 * no products, so a cross-area `next` produces a confusing dead end even when it
 * is not an attack.
 */
export type SignedInArea = "/admin" | "/app";

export function safeNextPath(
  next: string | undefined | null,
  area: SignedInArea = "/admin",
): string {
  if (!next) return area;

  // Reject absolute and protocol-relative URLs. "//evil.example" is a fully
  // valid absolute URL as far as a browser is concerned.
  if (!next.startsWith("/") || next.startsWith("//")) return area;

  // Some user agents normalise a backslash to a forward slash, so "/\evil.com"
  // can become "//evil.com" after this check would otherwise have passed.
  if (next.includes("\\")) return area;

  // Confine to the area being signed in to. Anchored on the segment boundary so
  // "/adminx/evil" does not slip through on a bare prefix match, and "/apple"
  // does not pass as "/app".
  if (
    next !== area &&
    !next.startsWith(`${area}/`) &&
    !next.startsWith(`${area}?`)
  ) {
    return area;
  }

  return next;
}
