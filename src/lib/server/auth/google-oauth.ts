import "server-only";

import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { base64UrlDecode, base64UrlEncode } from "@/lib/server/crypto";
import { getSiteUrl } from "@/lib/server/env";

/**
 * Google sign-in, as OpenID Connect authorization code flow with PKCE.
 *
 * Hand-rolled rather than pulled in with Auth.js, for the same reason the rest
 * of this application's auth is hand-rolled: sessions here are opaque
 * server-side records with an epoch, a revocation flag and a sliding expiry,
 * and a library that wants to own the session would have to be fought or
 * bypassed. What is actually needed from OIDC is one redirect, one token
 * exchange, and one signature check. That is this file.
 *
 * The ID token is verified rather than merely decoded. OIDC Core §3.1.3.7 does
 * permit a client to skip signature validation when the token came straight
 * from the token endpoint over TLS, which is our case — but "we fetched it
 * ourselves so it must be fine" is exactly the assumption that stops being true
 * the day somebody refactors this to accept a token from the client. Verifying
 * costs one cached JWKS fetch and makes the function safe to call with a token
 * of unknown provenance.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

/** Both spellings Google has issued over the years. Either is legitimate. */
const VALID_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

/** A little slack for clock drift between us and Google. */
const CLOCK_SKEW_SECONDS = 120;

/**
 * The registered redirect URI.
 *
 * Must match a value in the Google console **exactly** — Google compares the
 * string, not the resolved page. That makes the www prefix load-bearing: this
 * site's canonical origin is `www.bitecodes.com` and the apex 308-redirects to
 * it, so registering only the apex would send the browser through an extra hop
 * on the one request that carries the authorization code.
 */
export function googleRedirectUri(): string {
  return `${getSiteUrl()}/api/google/callback`;
}

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

function getGoogleClientSecret(): string | null {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
}

/**
 * Whether Google sign-in can work at all.
 *
 * Read by the sign-in pages so the button is shown only when pressing it would
 * lead somewhere. A button that always errors is worse than no button.
 */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export interface GoogleFlowSecrets {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Fresh, unguessable values for one attempt at signing in. */
export function createFlowSecrets(): GoogleFlowSecrets {
  return {
    state: base64UrlEncode(randomBytes(32)),
    nonce: base64UrlEncode(randomBytes(32)),
    codeVerifier: base64UrlEncode(randomBytes(64)),
  };
}

function codeChallenge(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

/**
 * Where to send the browser.
 *
 * `prompt: "select_account"` rather than the default: without it, somebody
 * already signed in to one Google account is silently signed in as that
 * account, which is wrong on a shared machine and confusing for anyone with a
 * work and a personal address.
 */
export function buildAuthorizationUrl(secrets: GoogleFlowSecrets): string {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set.");

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", secrets.state);
  url.searchParams.set("nonce", secrets.nonce);
  url.searchParams.set("code_challenge", codeChallenge(secrets.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export interface GoogleIdentity {
  /** Google's stable identifier. Survives the user changing their address. */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export type GoogleExchangeResult =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: string };

/**
 * Trades the authorization code for an identity.
 *
 * Everything that can be wrong is reported as `ok: false` with a reason for the
 * log — never thrown — because the caller is a redirect handler and the only
 * useful response to any failure is the same one: back to sign-in with a
 * message.
 */
export async function exchangeCodeForIdentity(
  code: string,
  codeVerifier: string,
  expectedNonce: string,
  now = Date.now(),
): Promise<GoogleExchangeResult> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, reason: "google-not-configured" };
  }

  let payload: { id_token?: unknown };
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      // Never cached: this is a one-time credential exchange.
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, reason: `token-endpoint-${response.status}` };
    }
    payload = (await response.json()) as { id_token?: unknown };
  } catch {
    return { ok: false, reason: "token-endpoint-unreachable" };
  }

  if (typeof payload.id_token !== "string") {
    return { ok: false, reason: "no-id-token" };
  }

  return verifyIdToken(payload.id_token, clientId, expectedNonce, now);
}

/**
 * Verifies an ID token and returns the identity it asserts.
 *
 * Exported so it can be tested directly against tokens minted by a throwaway
 * key pair — signature, issuer, audience, expiry and nonce each have their own
 * way of being wrong, and each needs its own test.
 */
export async function verifyIdToken(
  idToken: string,
  expectedAudience: string,
  expectedNonce: string,
  now = Date.now(),
): Promise<GoogleExchangeResult> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed-id-token" };
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [
    string,
    string,
    string,
  ];

  let header: { kid?: unknown; alg?: unknown };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8"));
    claims = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch {
    return { ok: false, reason: "unparsable-id-token" };
  }

  // Only RS256. Accepting whatever the header names is how "alg: none" and
  // algorithm-confusion attacks work — the token gets to choose how it is
  // checked, which is no check at all.
  if (header.alg !== "RS256") return { ok: false, reason: "unexpected-alg" };
  if (typeof header.kid !== "string") return { ok: false, reason: "no-kid" };

  const key = await findSigningKey(header.kid);
  if (!key) return { ok: false, reason: "unknown-kid" };

  const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8");
  let signatureValid = false;
  try {
    signatureValid = verify(
      "sha256",
      signed,
      key,
      base64UrlDecode(encodedSignature),
    );
  } catch {
    return { ok: false, reason: "signature-check-failed" };
  }
  if (!signatureValid) return { ok: false, reason: "bad-signature" };

  if (typeof claims.iss !== "string" || !VALID_ISSUERS.has(claims.iss)) {
    return { ok: false, reason: "bad-issuer" };
  }
  // `aud` pins the token to THIS client. Without it, an ID token issued to any
  // other Google app for the same person would be accepted here.
  if (claims.aud !== expectedAudience) {
    return { ok: false, reason: "bad-audience" };
  }
  // `nonce` pins it to the request we started. Without it, a token captured
  // from another sign-in could be replayed into this callback.
  if (claims.nonce !== expectedNonce) {
    return { ok: false, reason: "bad-nonce" };
  }

  const nowSeconds = Math.floor(now / 1000);
  if (
    typeof claims.exp !== "number" ||
    claims.exp + CLOCK_SKEW_SECONDS < nowSeconds
  ) {
    return { ok: false, reason: "expired" };
  }
  if (
    typeof claims.iat === "number" &&
    claims.iat - CLOCK_SKEW_SECONDS > nowSeconds
  ) {
    return { ok: false, reason: "issued-in-the-future" };
  }

  if (typeof claims.sub !== "string" || !claims.sub) {
    return { ok: false, reason: "no-subject" };
  }
  if (typeof claims.email !== "string" || !claims.email) {
    return { ok: false, reason: "no-email" };
  }

  return {
    ok: true,
    identity: {
      subject: claims.sub,
      email: claims.email,
      // Google sends this as a boolean or the string "true" depending on the
      // endpoint and vintage. Anything else is treated as unverified, which is
      // the safe direction: an unverified address never links to an account.
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === "string" ? claims.name : null,
      picture: typeof claims.picture === "string" ? claims.picture : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Google's signing keys
// ---------------------------------------------------------------------------

interface JsonWebKey {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

/** Google rotates roughly daily. An hour keeps us fresh without hammering. */
const JWKS_TTL_MS = 60 * 60 * 1000;

/**
 * Finds the key a token was signed with, refetching once on a miss.
 *
 * The refetch matters: Google publishes a new key before it starts signing with
 * it, but a cache that only expires on a timer would reject every token for up
 * to an hour after a rotation that happened early. An unknown `kid` is the
 * signal that the cache is stale, so it is treated as one — once, so that a
 * token with a made-up `kid` cannot be used to make us fetch in a loop.
 */
async function findSigningKey(kid: string) {
  const fromCache = selectKey(jwksCache?.keys, kid);
  if (fromCache) return fromCache;

  const keys = await fetchJwks();
  return selectKey(keys, kid);
}

function selectKey(keys: JsonWebKey[] | undefined, kid: string) {
  const jwk = keys?.find((candidate) => candidate.kid === kid);
  if (!jwk || jwk.kty !== "RSA" || !jwk.n || !jwk.e) return null;
  try {
    return createPublicKey({ key: jwk as never, format: "jwk" });
  } catch {
    return null;
  }
}

async function fetchJwks(): Promise<JsonWebKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    // Inside the TTL and the key was still not found: the document we have is
    // current, so refetching would not help.
    return jwksCache.keys;
  }
  try {
    const response = await fetch(JWKS_URI, { cache: "no-store" });
    if (!response.ok) return jwksCache?.keys ?? [];
    const body = (await response.json()) as { keys?: JsonWebKey[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    jwksCache = { keys, fetchedAt: Date.now() };
    return keys;
  } catch {
    // A network blip must not invalidate keys we already hold.
    return jwksCache?.keys ?? [];
  }
}

/** Test seam: lets a suite install a key set without reaching the network. */
export function __setJwksForTesting(keys: JsonWebKey[] | null): void {
  jwksCache = keys ? { keys, fetchedAt: Date.now() } : null;
}
