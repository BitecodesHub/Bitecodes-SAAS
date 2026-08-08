import "server-only";

import { getSiteUrl } from "@/lib/server/env";
import { isOriginAllowed } from "@/lib/chatbot/domains";

/**
 * Origin check for an embeddable record, including our own hosted pages.
 *
 * A customer's allowlist names *their* sites. The hosted pages — `/form/[formId]`
 * and `/book/[bookingId]`, both offered as iframe snippets in the admin UI — are
 * served from OUR origin, so the request they make carries `Origin:
 * https://www.bitecodes.com`. Checked against the customer's allowlist that is a
 * stranger's domain, and it was refused.
 *
 * The effect was that the iframe embed, which the product advertises alongside the
 * script tag, could never work for anyone who listed their real domain. It went
 * unnoticed because the only form exercising it had `["*"]`, and because local
 * testing runs on `localhost`, which the loopback rule already allows.
 *
 * So the platform's own origin is accepted alongside the allowlist. That is not a
 * hole being opened: the hosted page is *designed* to be framed by anyone, its URL
 * carries the public token as its credential, and the token is what authorises the
 * record — the domain list constrains where the SCRIPT embed may run, which is a
 * different question. A caller cannot forge an `Origin` header from a browser
 * anyway, so this grants nothing that pasting the iframe would not.
 */
export function isEmbedOriginAllowed(
  origin: string | null | undefined,
  allowedDomains: readonly string[],
): boolean {
  if (isOriginAllowed(origin, allowedDomains)) return true;
  return isPlatformOrigin(origin);
}

/** True when the request came from a page this deployment itself served. */
export function isPlatformOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    // Compared as parsed origins so a trailing slash, a case difference or an
    // explicit default port cannot make an equal pair look unequal.
    return new URL(origin).origin === new URL(getSiteUrl()).origin;
  } catch {
    return false;
  }
}
