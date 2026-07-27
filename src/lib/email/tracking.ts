import { isSafeEmailUrl } from "@/lib/email/template";

/**
 * Open- and click-tracking for outbound email.
 *
 * Pure: URL construction is injected, so this module is fully testable and the
 * signing logic stays on the server.
 *
 * The click redirect **must** be signed. A tracker of the shape
 * `/e/c?u=<url>` is an open redirect — anyone can borrow the sending domain's
 * reputation to bounce victims to a phishing page, and the domain gets
 * blacklisted for it. So the destination travels inside a signed token and the
 * redirect handler refuses anything it did not sign.
 */

/** Matches `href="..."` and `href='...'` in the rendered HTML. */
const HREF_PATTERN = /href=(["'])(.*?)\1/gi;

export interface RewriteOptions {
  /** Builds the tracked URL for a destination. Returns null to leave it alone. */
  makeClickUrl: (destination: string) => string | null;
  /** Absolute URLs matching these hosts are left untracked. */
  skipHosts?: string[];
}

/**
 * Rewrites every trackable link to go through the click redirect.
 *
 * Left untouched: `mailto:` links (no click to record and rewriting them would
 * break the mail client), the unsubscribe link (a tracked unsubscribe looks
 * like a dark pattern and some clients pre-fetch it), and anything the caller
 * lists in `skipHosts`.
 */
export function rewriteLinksForTracking(
  html: string,
  { makeClickUrl, skipHosts = [] }: RewriteOptions,
): { html: string; rewritten: number } {
  let rewritten = 0;

  const output = html.replace(
    HREF_PATTERN,
    (match, quote: string, url: string) => {
      if (!shouldTrack(url, skipHosts)) return match;
      const tracked = makeClickUrl(url);
      if (!tracked) return match;
      rewritten += 1;
      return `href=${quote}${tracked}${quote}`;
    },
  );

  return { html: output, rewritten };
}

function shouldTrack(url: string, skipHosts: string[]): boolean {
  if (!url || url.startsWith("#")) return false;
  if (!isSafeEmailUrl(url)) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Nothing to track on a mail client handing off to a compose window.
  if (parsed.protocol === "mailto:") return false;
  // Never track the unsubscribe link.
  if (/\/unsubscribe(\/|$|\?)/.test(parsed.pathname + parsed.search))
    return false;
  if (skipHosts.includes(parsed.host)) return false;

  return true;
}

/**
 * Appends the open-tracking pixel.
 *
 * Placed immediately before `</body>` so it loads last and cannot delay
 * rendering of the message itself. `alt=""` plus `aria-hidden` keeps a screen
 * reader from announcing a decorative image, and explicit 1×1 dimensions stop
 * clients that block images from reserving a visible gap.
 */
export function appendOpenPixel(html: string, pixelUrl: string): string {
  if (!isSafeEmailUrl(pixelUrl)) return html;

  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" aria-hidden="true" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;

  const closingBody = html.lastIndexOf("</body>");
  if (closingBody === -1) return html + pixel;
  return html.slice(0, closingBody) + pixel + html.slice(closingBody);
}

/**
 * Strips tracking from a stored message for display in the admin panel, so a
 * preview shows the real destinations rather than opaque redirect URLs.
 */
export function describeTrackedLinks(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(HREF_PATTERN)) {
    const url = match[2];
    if (url && isSafeEmailUrl(url)) found.push(url);
  }
  return found;
}
