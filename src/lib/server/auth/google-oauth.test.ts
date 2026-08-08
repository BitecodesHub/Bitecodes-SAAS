import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { base64UrlEncode } from "@/lib/server/crypto";
import {
  __setJwksForTesting,
  verifyIdToken,
} from "@/lib/server/auth/google-oauth";

/**
 * ID-token verification, tested against tokens this file signs itself.
 *
 * Every one of these assertions is a way somebody gets in as somebody else if
 * the check is missing, so each is exercised on its own rather than through one
 * happy path. The key pair is generated per run and thrown away: a fixture key
 * checked into a repository is a key an attacker can sign with.
 */

const AUDIENCE = "758102529675-example.apps.googleusercontent.com";
const NONCE = "nonce-from-the-flow-cookie";
const KID = "test-key-1";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
__setJwksForTesting([{ ...jwk, kid: KID, alg: "RS256", use: "sig" } as never]);

afterEach(() => {
  __setJwksForTesting([
    { ...jwk, kid: KID, alg: "RS256", use: "sig" } as never,
  ]);
});

interface Claims {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: unknown;
  nonce?: string;
  exp?: number;
  iat?: number;
  name?: string;
}

const NOW = 1_800_000_000_000;

function mintToken(
  overrides: Claims = {},
  options: { kid?: string; alg?: string; tamper?: boolean } = {},
): string {
  const header = base64UrlEncode(
    JSON.stringify({ alg: options.alg ?? "RS256", kid: options.kid ?? KID }),
  );
  const claims: Claims = {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    sub: "1234567890",
    email: "person@example.com",
    email_verified: true,
    nonce: NONCE,
    iat: Math.floor(NOW / 1000) - 30,
    exp: Math.floor(NOW / 1000) + 3600,
    name: "A Person",
    ...overrides,
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = sign(
    "sha256",
    Buffer.from(`${header}.${payload}`, "utf8"),
    privateKey,
  );
  const encoded = base64UrlEncode(signature);
  return `${header}.${payload}.${options.tamper ? `${encoded.slice(0, -4)}AAAA` : encoded}`;
}

async function verify(token: string, nonce = NONCE) {
  return verifyIdToken(token, AUDIENCE, nonce, NOW);
}

describe("a well-formed token", () => {
  it("is accepted and yields the identity", async () => {
    const result = await verify(mintToken());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity).toEqual({
        subject: "1234567890",
        email: "person@example.com",
        emailVerified: true,
        name: "A Person",
        picture: null,
      });
    }
  });

  it("accepts the bare issuer spelling Google also uses", async () => {
    const result = await verify(mintToken({ iss: "accounts.google.com" }));
    expect(result.ok).toBe(true);
  });
});

describe("signature", () => {
  it("rejects a tampered signature", async () => {
    const result = await verify(mintToken({}, { tamper: true }));
    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a token signed with a key we do not know", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", kid: KID }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: "https://accounts.google.com",
        aud: AUDIENCE,
        sub: "x",
        email: "a@b.com",
        nonce: NONCE,
        exp: Math.floor(NOW / 1000) + 60,
      }),
    );
    const signature = base64UrlEncode(
      sign(
        "sha256",
        Buffer.from(`${header}.${payload}`, "utf8"),
        other.privateKey,
      ),
    );
    const result = await verify(`${header}.${payload}.${signature}`);
    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses to let the token choose its own algorithm", async () => {
    // `alg: none` and algorithm confusion both work by trusting this header.
    for (const alg of ["none", "HS256", "RS512"]) {
      const result = await verify(mintToken({}, { alg }));
      expect(result, alg).toEqual({ ok: false, reason: "unexpected-alg" });
    }
  });

  it("rejects an unknown key id rather than trying another key", async () => {
    const result = await verify(mintToken({}, { kid: "some-other-kid" }));
    expect(result).toEqual({ ok: false, reason: "unknown-kid" });
  });
});

describe("claims", () => {
  it("rejects a token minted for another application", async () => {
    // Without this, an ID token issued to ANY Google app for this person would
    // sign them in here.
    const result = await verify(
      mintToken({ aud: "someone-else.apps.googleusercontent.com" }),
    );
    expect(result).toEqual({ ok: false, reason: "bad-audience" });
  });

  it("rejects a token from another issuer", async () => {
    const result = await verify(mintToken({ iss: "https://evil.example" }));
    expect(result).toEqual({ ok: false, reason: "bad-issuer" });
  });

  it("rejects a replayed token from a different flow", async () => {
    const result = await verify(mintToken({ nonce: "a-different-nonce" }));
    expect(result).toEqual({ ok: false, reason: "bad-nonce" });
  });

  it("rejects an expired token", async () => {
    const result = await verify(
      mintToken({ exp: Math.floor(NOW / 1000) - 3600 }),
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("allows a little clock skew either way", async () => {
    const justExpired = await verify(
      mintToken({ exp: Math.floor(NOW / 1000) - 60 }),
    );
    expect(justExpired.ok).toBe(true);

    const slightlyAhead = await verify(
      mintToken({ iat: Math.floor(NOW / 1000) + 60 }),
    );
    expect(slightlyAhead.ok).toBe(true);
  });

  it("rejects a token issued well in the future", async () => {
    const result = await verify(
      mintToken({ iat: Math.floor(NOW / 1000) + 7200 }),
    );
    expect(result).toEqual({ ok: false, reason: "issued-in-the-future" });
  });

  it("treats anything but boolean true as unverified", async () => {
    // Google has sent this as the string "true" historically. Only the boolean
    // counts, because the linking rule turns on it.
    for (const value of ["true", 1, "1", null, undefined]) {
      const result = await verify(mintToken({ email_verified: value }));
      expect(result.ok, String(value)).toBe(true);
      if (result.ok) {
        expect(result.identity.emailVerified, String(value)).toBe(false);
      }
    }
  });

  it("requires a subject and an email", async () => {
    expect(await verify(mintToken({ sub: undefined }))).toEqual({
      ok: false,
      reason: "no-subject",
    });
    expect(await verify(mintToken({ email: undefined }))).toEqual({
      ok: false,
      reason: "no-email",
    });
  });
});

describe("malformed input", () => {
  it("never throws, whatever it is handed", async () => {
    for (const token of [
      "",
      "a",
      "a.b",
      "a.b.c.d",
      "....",
      "not-base64.at-all.nope",
      `${base64UrlEncode("{}")}.${base64UrlEncode("{}")}.x`,
    ]) {
      const result = await verify(token);
      expect(result.ok, JSON.stringify(token)).toBe(false);
    }
  });
});
