/**
 * Whether a URL is safe to hand to `location.href`.
 *
 * This exists because `zod`'s `.url()` is a *shape* check, not a safety check. It
 * accepts `javascript:alert(1)`, `data:text/html,<script>…` and `vbscript:` —
 * verified against the version in this lockfile, not assumed. A form's
 * `redirectUrl` is assigned straight to `location.href` in two places, and one of
 * them is the hosted page at `/form/[formId]`, which is served from our own
 * origin — the same origin as `/admin`. An unrestricted scheme there is a stored
 * cross-site-scripting primitive, not a broken link.
 *
 * Pure and dependency-free so the identical rule can be applied at the boundary
 * where a value is saved AND at the sink where it is used. Both matter: the
 * boundary stops new bad values, and the sink protects against rows written
 * before the boundary existed.
 */

/** Schemes a browser can navigate to without executing script. */
const NAVIGABLE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * True only for an absolute http(s) URL.
 *
 * Relative URLs are rejected deliberately. A redirect target is stored by one
 * party and followed on a page served by another — an embedded form on a
 * customer's site — so "/thanks" would resolve differently depending on where the
 * form was embedded. Requiring an absolute URL makes the destination unambiguous.
 */
export function isNavigableHttpUrl(value: string): boolean {
  try {
    // No base: a bare path must fail rather than resolve against some origin.
    return NAVIGABLE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
