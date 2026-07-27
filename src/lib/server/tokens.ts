import "server-only";

import { z } from "zod";
import {
  base64UrlDecode,
  base64UrlEncode,
  hmacHex,
  safeCompare,
} from "@/lib/server/crypto";

/**
 * Stateless signed tokens for links that must work without a login:
 * unsubscribe, personalised prospect reports, client-portal magic links,
 * onboarding, and email tracking.
 *
 * Format: `<base64url(payload JSON)>.<base64url(HMAC-SHA256 hex)>`.
 *
 * Every token carries its purpose, and verification requires the caller to
 * state the purpose it expects. Without that, an unsubscribe token would also
 * be a valid portal-login token — the classic confused-deputy bug in
 * HMAC-signed link schemes.
 */

export type TokenPurpose =
  | "unsubscribe"
  | "report"
  | "portal-login"
  | "onboarding"
  | "password-reset"
  | "email-open"
  | "email-click";

const payloadSchema = z.object({
  /** Purpose. */
  p: z.string().min(1),
  /** Data. */
  d: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  /** Expiry, epoch seconds. 0 means the token never expires. */
  e: z.number().int().nonnegative(),
  /** Nonce, so two tokens with identical data are not byte-identical. */
  n: z.string().min(1),
});

export type TokenData = Record<string, string | number | boolean>;

interface CreateTokenOptions {
  purpose: TokenPurpose;
  data: TokenData;
  /** Omit for a non-expiring token (unsubscribe links must never expire). */
  ttlSeconds?: number;
}

export function createSignedToken({
  purpose,
  data,
  ttlSeconds,
}: CreateTokenOptions): string {
  const payload = {
    p: purpose,
    d: data,
    e: ttlSeconds ? Math.floor(Date.now() / 1000) + ttlSeconds : 0,
    // 6 bytes is plenty: the nonce prevents identical ciphertext, it is not a
    // secret and not used for authentication.
    n: base64UrlEncode(
      Buffer.from(
        Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      ),
    ).slice(0, 12),
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${base64UrlEncode(hmacHex(encoded))}`;
}

export type TokenVerification<T extends TokenData = TokenData> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: "malformed" | "bad-signature" | "wrong-purpose" | "expired";
    };

/**
 * Verifies a token and confirms it was issued for `expectedPurpose`.
 *
 * The signature is checked *before* the payload is parsed, so attacker-
 * controlled JSON never reaches the parser on an unsigned token.
 */
export function verifySignedToken<T extends TokenData = TokenData>(
  token: string | null | undefined,
  expectedPurpose: TokenPurpose,
  now = Date.now(),
): TokenVerification<T> {
  if (!token) return { ok: false, reason: "malformed" };

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return { ok: false, reason: "malformed" };
  }

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expectedSignature: string;
  try {
    expectedSignature = base64UrlEncode(hmacHex(encoded));
  } catch {
    // No signing secret configured — treat every token as invalid rather
    // than falling back to an unauthenticated comparison.
    return { ok: false, reason: "bad-signature" };
  }

  if (!safeCompare(signature, expectedSignature)) {
    return { ok: false, reason: "bad-signature" };
  }

  let parsed: z.infer<typeof payloadSchema>;
  try {
    const result = payloadSchema.safeParse(
      JSON.parse(base64UrlDecode(encoded).toString("utf8")),
    );
    if (!result.success) return { ok: false, reason: "malformed" };
    parsed = result.data;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (parsed.p !== expectedPurpose)
    return { ok: false, reason: "wrong-purpose" };
  if (parsed.e !== 0 && parsed.e * 1000 <= now) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, data: parsed.d as T };
}

/**
 * Verifies signature and purpose but **ignores expiry**.
 *
 * Deliberately separate from `verifySignedToken`, and deliberately narrow: the
 * only legitimate caller is the unsubscribe path.
 *
 * The reasoning is that the two checks guard different things. The signature
 * prevents forgery, and is non-negotiable. Expiry is a freshness concern — and
 * for an opt-out, freshness must never override consent. Refusing to honour a
 * cryptographically valid "stop emailing me" because a timestamp elapsed would
 * mean continuing to email someone who asked us not to, which is both
 * indefensible and, under CAN-SPAM, non-compliant.
 *
 * Implemented by verifying against epoch zero, so no expiry can be in the past.
 * Never use this for anything that grants access.
 */
export function verifySignedTokenIgnoringExpiry<
  T extends TokenData = TokenData,
>(
  token: string | null | undefined,
  expectedPurpose: TokenPurpose,
): TokenVerification<T> {
  return verifySignedToken<T>(token, expectedPurpose, 0);
}

export const TOKEN_TTL = {
  /** Long-lived: a prospect may open a cold email weeks later. */
  report: 90 * 24 * 60 * 60,
  /** Short-lived: a magic link is a credential. */
  portalLogin: 30 * 60,
  onboarding: 30 * 24 * 60 * 60,
  passwordReset: 60 * 60,
} as const;
