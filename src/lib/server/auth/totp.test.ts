import { describe, expect, it } from "vitest";
import {
  TOTP_CONFIG,
  base32Decode,
  base32Encode,
  buildTotpUri,
  formatSecretForDisplay,
  generateHotp,
  generateTotp,
  generateTotpSecret,
  verifyTotp,
} from "@/lib/server/auth/totp";

/**
 * "12345678901234567890" — the RFC 4226 test key, base32-encoded. The RFC
 * publishes expected codes for this key, which is the only way to be sure an
 * OTP implementation interoperates with real authenticator apps rather than
 * merely being self-consistent.
 */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("round-trips", () => {
    for (const value of [
      "",
      "a",
      "ab",
      "abc",
      "abcd",
      "abcde",
      "hello world",
    ]) {
      const encoded = base32Encode(Buffer.from(value, "utf8"));
      expect(base32Decode(encoded).toString("utf8"), value).toBe(value);
    }
  });

  it("round-trips arbitrary bytes", () => {
    const input = Buffer.from(
      Array.from({ length: 40 }, (_, index) => (index * 37) % 256),
    );
    expect(base32Decode(base32Encode(input)).equals(input)).toBe(true);
  });

  it("emits only RFC 4648 alphabet characters", () => {
    expect(base32Encode(Buffer.from("test secret value"))).toMatch(
      /^[A-Z2-7]+$/,
    );
  });

  it("accepts input the way a user pastes it", () => {
    // Authenticator setup screens show secrets grouped and spaced.
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const messy = `${formatSecretForDisplay(secret).toLowerCase()}==`;
    expect(base32Decode(messy).equals(base32Decode(secret))).toBe(true);
  });

  it("rejects characters outside the alphabet", () => {
    // 0, 1, and 8 are excluded from base32 precisely because they are confused
    // with O, I, and B.
    expect(() => base32Decode("ABC1")).toThrow();
    expect(() => base32Decode("ABC0")).toThrow();
    expect(() => base32Decode("ABC!")).toThrow();
  });
});

describe("generateHotp — RFC 4226 test vectors", () => {
  it("matches the published values for counters 0-9", () => {
    // Appendix D of RFC 4226. If these pass, the HMAC, the big-endian counter,
    // the dynamic truncation offset, and the modulus are all correct.
    const expected = [
      "755224",
      "287082",
      "359152",
      "969429",
      "338314",
      "254676",
      "287922",
      "162583",
      "399871",
      "520489",
    ];
    for (const [counter, code] of expected.entries()) {
      expect(generateHotp(RFC_SECRET, counter), `counter ${counter}`).toBe(
        code,
      );
    }
  });
});

describe("generateTotp — RFC 6238 test vectors", () => {
  it("matches the published SHA-1 values", () => {
    // Appendix B of RFC 6238, SHA-1 rows, truncated to 6 digits.
    const vectors: [number, string][] = [
      [59, "287082"],
      [1_111_111_109, "081804"],
      [1_111_111_111, "050471"],
      [1_234_567_890, "005924"],
      [2_000_000_000, "279037"],
    ];
    for (const [seconds, code] of vectors) {
      expect(generateTotp(RFC_SECRET, seconds * 1000), String(seconds)).toBe(
        code,
      );
    }
  });

  it("produces the same code throughout a 30-second step", () => {
    const base = 1_111_111_109 * 1000;
    const step = Math.floor(base / 1000 / 30) * 30 * 1000;
    expect(generateTotp(RFC_SECRET, step)).toBe(
      generateTotp(RFC_SECRET, step + 29_000),
    );
  });

  it("produces a different code in the next step", () => {
    const step = 1_500_000_000 * 1000;
    expect(generateTotp(RFC_SECRET, step)).not.toBe(
      generateTotp(RFC_SECRET, step + 30_000),
    );
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;

  it("accepts the current code", () => {
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now), now)).toBe(
      true,
    );
  });

  it("accepts one step either side, for clock drift", () => {
    // Without this, typing a code as it rolls over fails for no visible reason.
    expect(
      verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - 30_000), now),
    ).toBe(true);
    expect(
      verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now + 30_000), now),
    ).toBe(true);
  });

  it("rejects two steps away, so an old code does not stay usable", () => {
    expect(
      verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - 90_000), now),
    ).toBe(false);
    expect(
      verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now + 90_000), now),
    ).toBe(false);
  });

  it("accepts a code typed with a space, as apps display it", () => {
    const code = generateTotp(RFC_SECRET, now);
    expect(
      verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now),
    ).toBe(true);
  });

  it("rejects malformed codes without throwing", () => {
    for (const code of [
      "",
      "12345",
      "1234567",
      "abcdef",
      "12345a",
      "  ",
      "-12345",
    ]) {
      expect(verifyTotp(RFC_SECRET, code, now), JSON.stringify(code)).toBe(
        false,
      );
    }
  });

  it("rejects a code from a different secret", () => {
    const other = generateTotpSecret();
    expect(verifyTotp(RFC_SECRET, generateTotp(other, now), now)).toBe(false);
  });

  it("returns false for a malformed secret rather than throwing", () => {
    // Guards against a corrupted stored secret taking down sign-in.
    expect(verifyTotp("not!valid!base32", "123456", now)).toBe(false);
    expect(verifyTotp("", "123456", now)).toBe(false);
  });

  it("does not crash near the epoch, where the window goes negative", () => {
    expect(() => verifyTotp(RFC_SECRET, "123456", 0)).not.toThrow();
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, 0), 0)).toBe(true);
  });
});

describe("generateTotpSecret", () => {
  it("produces a 20-byte base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(secret).length).toBe(20);
  });

  it("is unique across draws", () => {
    const secrets = new Set(
      Array.from({ length: 200 }, () => generateTotpSecret()),
    );
    expect(secrets.size).toBe(200);
  });

  it("produces a secret its own verifier accepts", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, generateTotp(secret, now), now)).toBe(true);
  });
});

describe("buildTotpUri", () => {
  it("includes the issuer both as a prefix and as a parameter", () => {
    // Older apps read only the label prefix, newer ones only the parameter;
    // omitting either leaves an unlabelled entry in someone's authenticator.
    const uri = buildTotpUri({ secret: RFC_SECRET, email: "a@bitecodes.com" });
    expect(
      uri.startsWith("otpauth://totp/Bitecodes%3Aa%40bitecodes.com?"),
    ).toBe(true);
    expect(uri).toContain("issuer=Bitecodes");
  });

  it("declares the parameters the code was generated with", () => {
    const uri = buildTotpUri({ secret: RFC_SECRET, email: "a@b.com" });
    expect(uri).toContain(`digits=${TOTP_CONFIG.DIGITS}`);
    expect(uri).toContain(`period=${TOTP_CONFIG.PERIOD_SECONDS}`);
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain(`secret=${RFC_SECRET}`);
  });

  it("escapes an email that would otherwise break the URI", () => {
    const uri = buildTotpUri({
      secret: RFC_SECRET,
      email: "a+tag@bitecodes.com",
      issuer: "Bite Codes",
    });
    expect(uri).not.toMatch(/otpauth:\/\/totp\/[^?]*[ +]/);
    expect(() => new URL(uri)).not.toThrow();
  });
});

describe("formatSecretForDisplay", () => {
  it("groups into blocks of four", () => {
    expect(formatSecretForDisplay("ABCDEFGH")).toBe("ABCD EFGH");
    expect(formatSecretForDisplay("ABCDEF")).toBe("ABCD EF");
  });

  it("stays decodable after formatting", () => {
    const secret = generateTotpSecret();
    expect(
      base32Decode(formatSecretForDisplay(secret)).equals(base32Decode(secret)),
    ).toBe(true);
  });
});
