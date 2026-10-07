import { beforeAll, describe, expect, it } from "vitest";

// AUTH_SECRET must be present before crypto derives its key.
beforeAll(() => {
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-chars-long-xx";
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a provider API key", async () => {
    const { encryptSecret, decryptSecret } =
      await import("@/lib/server/crypto");
    const key = "nvapi-abc123_DEF456-xyz";
    const token = encryptSecret(key);
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain(key);
    expect(decryptSecret(token)).toBe(key);
  });

  it("produces a different ciphertext each time (random IV) but same plaintext", async () => {
    const { encryptSecret, decryptSecret } =
      await import("@/lib/server/crypto");
    const a = encryptSecret("same-key");
    const b = encryptSecret("same-key");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-key");
    expect(decryptSecret(b)).toBe("same-key");
  });

  it("returns null for tampered, malformed, or wrong-version tokens", async () => {
    const { encryptSecret, decryptSecret } =
      await import("@/lib/server/crypto");
    const token = encryptSecret("key");
    const parts = token.split(".");
    // Flip a byte in the ciphertext → auth tag rejects it.
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].slice(0, -2)}AA`;
    expect(decryptSecret(tampered)).toBeNull();
    expect(decryptSecret("v2.a.b.c")).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
    expect(decryptSecret("")).toBeNull();
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
  });

  it("handles empty and unicode strings", async () => {
    const { encryptSecret, decryptSecret } =
      await import("@/lib/server/crypto");
    expect(decryptSecret(encryptSecret(""))).toBe("");
    const u = "clé-🔑-秘密";
    expect(decryptSecret(encryptSecret(u))).toBe(u);
  });

  it("secretHint exposes only the last 4 characters", async () => {
    const { secretHint } = await import("@/lib/server/crypto");
    expect(secretHint("sk-abcdef1234")).toBe("1234");
    expect(secretHint("xy")).toBe("");
  });
});
