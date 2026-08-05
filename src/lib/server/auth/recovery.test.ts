import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Recovery-token lifecycle tests against a real MongoDB.
 *
 * The email-sending entry points are exercised end-to-end manually (they need
 * SMTP); what must be provably correct is the token state machine: single use,
 * purpose isolation, expiry, and the session-epoch bump on reset.
 */
describeWithDatabase("account recovery", () => {
  useTestDatabase();

  const EMAIL = "owner@example.com";
  let userId: string;

  async function seedUser(overrides: Record<string, unknown> = {}) {
    const { adminUsers } = await import("@/lib/server/db/collections");
    const { hashPassword } = await import("@/lib/server/crypto");
    const users = await adminUsers();
    await users.deleteMany({});

    const now = new Date();
    const result = await users.insertOne({
      email: EMAIL,
      name: "Owner",
      role: "owner",
      passwordHash: await hashPassword("Old-Password-1!"),
      status: "active",
      totpSecret: null,
      totpEnabledAt: null,
      failedAttempts: 3,
      lockedUntil: null,
      lastLoginAt: null,
      sessionEpoch: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as never);
    return result.insertedId.toHexString();
  }

  async function seedToken(
    purpose: "password-reset" | "login-link",
    overrides: Record<string, unknown> = {},
  ) {
    const { adminTokens } = await import("@/lib/server/db/collections");
    const { randomToken, sha256Hex } = await import("@/lib/server/crypto");
    const token = randomToken(32);
    const now = new Date();

    const collection = await adminTokens();
    await collection.insertOne({
      tokenHash: sha256Hex(token),
      userId,
      purpose,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      usedAt: null,
      ...overrides,
    } as never);
    return token;
  }

  beforeEach(async () => {
    userId = await seedUser();
    const { adminTokens } = await import("@/lib/server/db/collections");
    await (await adminTokens()).deleteMany({});
  });

  it("consumes a valid token exactly once", async () => {
    const { consumeToken } = await import("@/lib/server/auth/recovery");
    const token = await seedToken("login-link");

    expect(await consumeToken(token, "login-link")).toBe(userId);
    // The second consumption of the same link must fail.
    expect(await consumeToken(token, "login-link")).toBeNull();
  });

  it("refuses a token issued for a different purpose", async () => {
    const { consumeToken } = await import("@/lib/server/auth/recovery");
    const token = await seedToken("password-reset");

    expect(await consumeToken(token, "login-link")).toBeNull();
    // The failed cross-purpose attempt must not have burned the token.
    expect(await consumeToken(token, "password-reset")).toBe(userId);
  });

  it("refuses an expired token", async () => {
    const { consumeToken } = await import("@/lib/server/auth/recovery");
    const token = await seedToken("password-reset", {
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(await consumeToken(token, "password-reset")).toBeNull();
  });

  it("peeks without consuming", async () => {
    const { consumeToken, peekToken } =
      await import("@/lib/server/auth/recovery");
    const token = await seedToken("login-link");

    expect(await peekToken(token, "login-link")).toBe(true);
    expect(await peekToken(token, "login-link")).toBe(true);
    expect(await consumeToken(token, "login-link")).toBe(userId);
    expect(await peekToken(token, "login-link")).toBe(false);
  });

  it("resets the password, clears the lockout, and bumps the epoch", async () => {
    const { performPasswordReset } = await import("@/lib/server/auth/recovery");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const { adminUsers } = await import("@/lib/server/db/collections");
    const token = await seedToken("password-reset");

    const result = await performPasswordReset(token, "New-Password-22!");
    expect(result.ok).toBe(true);

    const user = await (await adminUsers()).findOne({ email: EMAIL });
    expect(user?.sessionEpoch).toBe(2);
    expect(user?.failedAttempts).toBe(0);

    expect((await authenticateAdmin(EMAIL, "Old-Password-1!")).ok).toBe(false);
    expect((await authenticateAdmin(EMAIL, "New-Password-22!")).ok).toBe(true);
  });

  it("rejects a reset with a used token", async () => {
    const { performPasswordReset } = await import("@/lib/server/auth/recovery");
    const token = await seedToken("password-reset");

    expect((await performPasswordReset(token, "New-Password-22!")).ok).toBe(
      true,
    );
    const second = await performPasswordReset(token, "Another-Password-3!");
    expect(second).toEqual({ ok: false, reason: "invalid-token" });
  });

  it("redeems a login link for an active user only", async () => {
    const { redeemLoginLink } = await import("@/lib/server/auth/recovery");
    const { adminUsers } = await import("@/lib/server/db/collections");

    const token = await seedToken("login-link");
    const result = await redeemLoginLink(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe("owner");
      expect(result.sessionEpoch).toBe(1);
    }

    // A disabled account must not be signable-in even with a fresh link.
    await (
      await adminUsers()
    ).updateOne({ email: EMAIL }, { $set: { status: "disabled" } });
    const second = await seedToken("login-link");
    expect((await redeemLoginLink(second)).ok).toBe(false);
  });

  it("does not reveal whether an address exists", async () => {
    const { requestPasswordReset } = await import("@/lib/server/auth/recovery");
    // Unknown address: resolves without throwing and writes no token.
    await requestPasswordReset("nobody@example.com");
    const { adminTokens } = await import("@/lib/server/db/collections");
    expect(await (await adminTokens()).countDocuments({})).toBe(0);
  });
});
