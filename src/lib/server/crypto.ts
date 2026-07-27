import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";
import { getSigningSecret } from "@/lib/server/env";

/**
 * `promisify` resolves to the shortest `scrypt` overload, which omits the
 * options argument. The cast restores the four-argument form so the cost
 * parameters can be passed.
 */
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Shared cryptographic primitives. Everything here uses `node:crypto` rather
 * than a dependency: the algorithms needed (SHA-256, HMAC, scrypt) are all in
 * the standard library, and an auth dependency is a supply-chain surface this
 * project does not need.
 */

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** URL-safe base64 without padding — safe in cookies, URLs, and headers. */
export function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  // Restore the padding base64 requires.
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/** A cryptographically random, URL-safe opaque token. */
export function randomToken(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Keyed hash. Used where the output must not be brute-forceable offline. */
export function hmacHex(value: string, secret = getSigningSecret()): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Hashes a client IP for storage. Keyed, so a database leak does not let an
 * attacker confirm whether a given address visited by hashing candidates.
 * Falls back to an unkeyed hash when no secret is configured, matching the
 * behaviour the existing API routes already rely on.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  try {
    return hmacHex(`ip:${ip}`);
  } catch {
    return sha256Hex(`ip:${ip}`);
  }
}

/** Constant-time comparison of two hex digests of the same length. */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

/**
 * scrypt parameters. N=2^15 with r=8 costs roughly 100 ms and 32 MB per hash
 * on a modern server — deliberately slow enough to make offline cracking
 * expensive while staying acceptable for an interactive login.
 */
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
// 128 * N * r is the working-set size; the default 32 MB cap is exactly at the
// limit, so raise it to leave headroom.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/** Encodes as `scrypt$N$r$p$salt$hash` so parameters can change over time. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(
    password.normalize("NFKC"),
    salt,
    SCRYPT_KEYLEN,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
  );

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verifies a password against a stored hash. Returns false rather than
 * throwing on a malformed hash so a corrupted record cannot be distinguished
 * from a wrong password by an attacker watching for error responses.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let expected: Buffer;
  try {
    expected = Buffer.from(hashRaw!, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const derived = await scrypt(
      password.normalize("NFKC"),
      Buffer.from(saltRaw!, "base64"),
      expected.length,
      { N, r, p, maxmem: SCRYPT_MAXMEM },
    );
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Password policy for admin accounts. Returned messages are shown verbatim in
 * the UI, so they describe what to do rather than what went wrong.
 */
export function validatePasswordStrength(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push("Use at least 12 characters.");
  if (password.length > 200) problems.push("Use at most 200 characters.");
  if (!/[a-z]/.test(password)) problems.push("Include a lowercase letter.");
  if (!/[A-Z]/.test(password)) problems.push("Include an uppercase letter.");
  if (!/[0-9]/.test(password)) problems.push("Include a number.");
  if (!/[^A-Za-z0-9]/.test(password)) {
    problems.push("Include a symbol.");
  }
  return problems;
}
