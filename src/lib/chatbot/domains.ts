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

  // A bare `*` means "any site", which is what everyone who types it expects.
  //
  // It used to be compared literally — `host === "*"` — so an allowlist of `["*"]`
  // matched nothing at all and refused every origin including the owner's own
  // site. That is the worst kind of failure: the setting reads as maximally
  // permissive and behaves as maximally restrictive, and the operator gets
  // "not enabled for this website" on the one domain they were sure they had
  // configured. Whether to permit any origin is the owner's decision to make;
  // silently inverting it is not.
  if (pattern === "*") return true;

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
/**
 * Loopback hosts, which are always permitted regardless of the allowlist.
 *
 * A developer integrating the widget serves their page from `localhost` on some
 * arbitrary port, and the only way to reach a real bot was to add `localhost` to
 * a production allowlist and remember to remove it. That is a bad instruction to
 * give a customer, and one they will forget the second half of.
 *
 * `.localhost` is included because the whole TLD is reserved for loopback by
 * RFC 6761, so `app.localhost` cannot resolve anywhere else.
 *
 * The security trade, stated rather than glossed: a public chat token is visible
 * in the page source of any site using it, so allowing loopback means anyone
 * holding a token could spend it from their own machine. Two things bound that,
 * and they are why this is an acceptable trade rather than a hole: the `chat`
 * rate limit is 40 messages per hour per bot per IP, and every message is
 * metered against the owner's balance with the spend visible in the ledger. It
 * cannot be used to read anything — only to consume a capped amount of quota.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
}

export function isOriginAllowed(
  origin: string | null | undefined,
  allowedDomains: readonly string[],
): boolean {
  const host = hostFromOrigin(origin);
  if (!host) return false;

  // Checked before the allowlist, and deliberately before the empty-list guard:
  // a brand-new bot with no domains configured yet must still be testable from a
  // developer's machine, which is when they most need to see it work.
  if (isLoopbackHost(host)) return true;

  if (!allowedDomains || allowedDomains.length === 0) return false;
  return allowedDomains.some((pattern) => matchesPattern(host, pattern));
}
