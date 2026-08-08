import "server-only";

import { base64UrlDecode, base64UrlEncode } from "@/lib/server/crypto";

/**
 * The cookie that carries one sign-in attempt across the trip to Google.
 *
 * Its own module because both route handlers need it and neither should own it,
 * and because the shape of what is stored is a security decision worth reading
 * on its own.
 *
 * Everything the callback needs to trust lives here rather than in the URL:
 * `state` is the only value that also travels through Google, and it travels as
 * an opaque comparison token, not as a container for anything. In particular
 * `next` is kept here, so the destination cannot be rewritten by editing the
 * URL Google sends the browser to — the classic way an OAuth callback becomes
 * an open redirect.
 *
 * The cookie is not signed. It does not need to be: it is `httpOnly`, so page
 * scripts cannot read or write it, and a cross-site attacker cannot set a
 * cookie on this host at all. Its integrity comes from being ours.
 */

export const GOOGLE_FLOW_COOKIE = "bc_google_flow";

/**
 * How long the round trip may take.
 *
 * Ten minutes is generous for choosing an account and long enough to survive a
 * password prompt or a second factor on Google's side, while keeping the window
 * in which a stolen cookie is worth anything short.
 */
const FLOW_TTL_SECONDS = 10 * 60;

export interface GoogleFlowState {
  state: string;
  nonce: string;
  codeVerifier: string;
  next: string;
}

export function flowCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `strict` would not be sent on the top-level navigation Google returns
    // through, so every sign-in would fail its own state check.
    sameSite: "lax" as const,
    path: "/",
    maxAge: FLOW_TTL_SECONDS,
  };
}

export function encodeFlowCookie(value: GoogleFlowState): string {
  return base64UrlEncode(JSON.stringify(value));
}

/** Returns null for anything that is not a well-formed flow cookie. */
export function decodeFlowCookie(
  raw: string | undefined,
): GoogleFlowState | null {
  if (!raw || raw.length > 4000) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(raw).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { state, nonce, codeVerifier, next } = parsed as Record<
      string,
      unknown
    >;
    if (
      typeof state !== "string" ||
      typeof nonce !== "string" ||
      typeof codeVerifier !== "string" ||
      typeof next !== "string"
    ) {
      return null;
    }
    if (!state || !nonce || !codeVerifier) return null;
    return { state, nonce, codeVerifier, next };
  } catch {
    return null;
  }
}
