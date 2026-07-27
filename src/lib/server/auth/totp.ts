import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP two-factor authentication (RFC 6238), implemented on `node:crypto`.
 *
 * No dependency: the algorithm is an HMAC, a base32 codec, and a truncation
 * rule. Every authenticator app (Google Authenticator, 1Password, Authy) uses
 * the same defaults — SHA-1, 6 digits, a 30-second step — so those are fixed
 * rather than configurable. SHA-1 here is not a weakness: HMAC-SHA1 has no
 * practical break, and the collision attacks on plain SHA-1 do not apply.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;

/**
 * How many steps either side of now are accepted.
 *
 * ±1 tolerates clock drift between the server and the phone, and the common
 * case of typing a code as it rolls over. Wider would meaningfully extend the
 * window in which an observed code stays usable.
 */
const WINDOW_STEPS = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A 20-byte secret, base32-encoded — the size RFC 4226 recommends for SHA-1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decodes base32, ignoring padding, spaces, and case.
 *
 * Lenient on input because users paste secrets by hand from a display that
 * groups them into spaced blocks of four.
 */
export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Generates the code for a given counter value. */
export function generateHotp(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // 8-byte big-endian counter. `writeBigUInt64BE` because a JS number cannot
  // hold the full 64-bit range exactly.
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(buffer).digest();

  // Dynamic truncation (RFC 4226 §5.4): the low nibble of the last byte picks
  // the 4-byte window, and the top bit is masked off to keep it positive.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secret: string, atMs = Date.now()): string {
  return generateHotp(secret, Math.floor(atMs / 1000 / PERIOD_SECONDS));
}

/**
 * Verifies a code against the current step and its immediate neighbours.
 *
 * Compares in constant time and normalises the input first: authenticator apps
 * display codes as "123 456", and users paste them that way.
 */
export function verifyTotp(
  secret: string,
  code: string,
  atMs = Date.now(),
): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const step = Math.floor(atMs / 1000 / PERIOD_SECONDS);

  for (let offset = -WINDOW_STEPS; offset <= WINDOW_STEPS; offset += 1) {
    const counter = step + offset;
    if (counter < 0) continue;
    try {
      const expected = generateHotp(secret, counter);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) {
        return true;
      }
    } catch {
      // A malformed secret cannot authenticate anything.
      return false;
    }
  }

  return false;
}

/**
 * The `otpauth://` URI an authenticator app scans.
 *
 * The label carries the issuer as a prefix *and* as a parameter — older apps
 * read only the prefix, newer ones only the parameter, and without both the
 * entry shows up unlabelled in someone's authenticator.
 */
export function buildTotpUri({
  secret,
  email,
  issuer = "Bitecodes",
}: {
  secret: string;
  email: string;
  issuer?: string;
}): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const parameters = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${parameters.toString()}`;
}

/** Groups a secret into blocks of four for manual entry. */
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export const TOTP_CONFIG = { DIGITS, PERIOD_SECONDS, WINDOW_STEPS } as const;
