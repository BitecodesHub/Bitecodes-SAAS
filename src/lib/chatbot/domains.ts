/**
 * Domain allowlist matching for chatbot widgets.
 *
 * Pure and framework-free so it can run in the widget-auth hot path and be
 * unit-tested exhaustively. The widget sends an `Origin`; we compare its host
 * against the bot's allowlist. Supports exact hosts and a single-label
 * wildcard (`*.company.com`), which matches `app.company.com` but NOT the apex
 * `company.com` unless the apex is also listed — matching how TLS wildcards and
 * CORS allowlists behave, so operators are not surprised.
 */

/** Extracts the lowercased host from an Origin/URL, or null if unparseable. */
export function hostFromOrigin(
  origin: string | null | undefined,
): string | null {
  if (!origin) return null;
  const trimmed = origin.trim();
  if (!trimmed) return null;
  try {
    // Accept a bare host too (no scheme), by giving the URL parser a scheme.
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Normalises an allowlist entry: lowercase, strip scheme/path/port and `www.`. */
export function normalizeDomainPattern(pattern: string): string {
  let p = pattern.trim().toLowerCase();
  if (!p) return "";
  p = p
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  return p;
}

function matchesPattern(host: string, rawPattern: string): boolean {
  const pattern = normalizeDomainPattern(rawPattern);
  if (!pattern) return false;

  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    // `*.company.com` → any single-or-multi-label subdomain, not the apex.
    return host === base ? false : host.endsWith(`.${base}`);
  }
  // Exact match, tolerating a leading www. on the visitor's host.
  return (
    host === pattern || host === `www.${pattern}` || `www.${host}` === pattern
  );
}

/**
 * True when `origin`'s host is permitted by any allowlist entry.
 *
 * An empty allowlist denies everything: a bot with no configured domains is
 * not embeddable yet, which is the safe default (fail closed).
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  allowedDomains: readonly string[],
): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return false;
  const host = hostFromOrigin(origin);
  if (!host) return false;
  return allowedDomains.some((pattern) => matchesPattern(host, pattern));
}
