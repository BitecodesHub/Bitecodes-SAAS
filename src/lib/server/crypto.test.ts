import { beforeAll, describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  hashIp,
  hashPassword,
  hmacHex,
  randomToken,
  safeCompare,
  sha256Hex,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/server/crypto";

const TEST_SECRET = "test-secret-at-least-32-characters-long-000";

beforeAll(() => {
  process.env.AUTH_SECRET = TEST_SECRET;
});

describe("base64url", () => {
  it("round-trips binary data", () => {
    const input = Buffer.from([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlDecode(base64UrlEncode(input)).equals(input)).toBe(true);
  });

  it("round-trips strings including multi-byte characters", () => {
    for (const value of ["", "a", "ab", "abc", "abcd", "héllo — wörld 🌍"]) {
      expect(base64UrlDecode(base64UrlEncode(value)).toString("utf8")).toBe(
        value,
      );
    }
  });

  it("never emits characters that need URL escaping", () => {
    // 512 bytes of every byte value guarantees +, / and = would appear in
    // standard base64.
    const input = Buffer.from(
      Array.from({ length: 512 }, (_, index) => index % 256),
    );
    expect(base64UrlEncode(input)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("randomToken", () => {
  it("is URL-safe and unique across many draws", () => {
    const tokens = new Set(
      Array.from({ length: 500 }, () => {
        const token = randomToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        return token;
      }),
    );
    expect(tokens.size).toBe(500);
  });

  it("honours the requested byte length", () => {
    expect(base64UrlDecode(randomToken(16)).length).toBe(16);
    expect(base64UrlDecode(randomToken(48)).length).toBe(48);
  });
});

describe("hashing", () => {
  it("sha256Hex is stable and 64 hex characters", () => {
    expect(sha256Hex("bitecodes")).toBe(sha256Hex("bitecodes"));
    expect(sha256Hex("bitecodes")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });

  it("hmacHex depends on the key", () => {
    expect(hmacHex("value", "key-one-padded-to-32-characters-xx")).not.toBe(
      hmacHex("value", "key-two-padded-to-32-characters-xx"),
    );
  });

  it("hashIp is deterministic, keyed, and null-safe", () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
    expect(hashIp("")).toBeNull();
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
    // Keyed, so it is not a bare sha256 of the address.
    expect(hashIp("203.0.113.9")).not.toBe(sha256Hex("ip:203.0.113.9"));
  });
});

describe("safeCompare", () => {
  it("matches identical strings and rejects everything else", () => {
    expect(safeCompare("abc123", "abc123")).toBe(true);
    expect(safeCompare("abc123", "abc124")).toBe(false);
    // Different lengths must not throw.
    expect(safeCompare("abc", "abcdef")).toBe(false);
    expect(safeCompare("", "")).toBe(true);
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-9!");
    expect(await verifyPassword("Correct-Horse-Battery-9!", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-battery-9!", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts each hash, so identical passwords differ", async () => {
    const [first, second] = await Promise.all([
      hashPassword("SamePassword-123!"),
      hashPassword("SamePassword-123!"),
    ]);
    expect(first).not.toBe(second);
    expect(await verifyPassword("SamePassword-123!", first)).toBe(true);
    expect(await verifyPassword("SamePassword-123!", second)).toBe(true);
  });

  it("encodes its parameters so they can be changed later", async () => {
    const hash = await hashPassword("Parameterised-123!");
    const [algorithm, N, r, p] = hash.split("$");
    expect(algorithm).toBe("scrypt");
    expect(Number(N)).toBe(32_768);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(hash.split("$")).toHaveLength(6);
  });

  it("normalises unicode so equivalent input verifies", async () => {
    // "é" as a single code point vs. "e" + combining acute.
    const hash = await hashPassword("Café-Password-1!");
    expect(await verifyPassword("Café-Password-1!", hash)).toBe(true);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$1$2$3",
      "bcrypt$32768$8$1$c2FsdA==$aGFzaA==",
      "scrypt$abc$8$1$c2FsdA==$aGFzaA==",
      "scrypt$32768$8$1$c2FsdA==$",
    ]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("Str0ng-Passphrase!")).toEqual([]);
  });

  it("reports every unmet requirement", () => {
    expect(validatePasswordStrength("short")).toEqual([
      "Use at least 12 characters.",
      "Include an uppercase letter.",
      "Include a number.",
      "Include a symbol.",
    ]);
    expect(validatePasswordStrength("alllowercase1!")).toEqual([
      "Include an uppercase letter.",
    ]);
    expect(validatePasswordStrength("ALLUPPERCASE1!")).toEqual([
      "Include a lowercase letter.",
    ]);
    expect(validatePasswordStrength("NoNumbersHere!")).toEqual([
      "Include a number.",
    ]);
    expect(validatePasswordStrength("NoSymbolsHere1")).toEqual([
      "Include a symbol.",
    ]);
  });

  it("rejects absurdly long input", () => {
    expect(validatePasswordStrength(`Aa1!${"x".repeat(300)}`)).toEqual([
      "Use at most 200 characters.",
    ]);
  });
});
