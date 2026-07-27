import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Login integration tests against a real MongoDB.
 *
 * Deliberately not mocked. What is being tested here is the interaction between
 * the lockout counter, the status field, and the session epoch — all of which
 * live in the database, and all of which a fake would simply reimplement.
 */
describeWithDatabase("authenticateAdmin", () => {
  useTestDatabase();

  const PASSWORD = "Correct-Horse-Battery-9!";
  const EMAIL = "owner@example.com";

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
      passwordHash: await hashPassword(PASSWORD),
      status: "active",
      totpSecret: null,
      totpEnabledAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      sessionEpoch: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as never);
    return result.insertedId.toHexString();
  }

  beforeEach(async () => {
    await seedUser();
  });

  it("accepts the correct password", async () => {
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const result = await authenticateAdmin(EMAIL, PASSWORD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe("owner");
      expect(result.sessionEpoch).toBe(1);
      expect(result.email).toBe(EMAIL);
    }
  });

  it("normalises the email, so case and padding do not lock people out", async () => {
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    expect((await authenticateAdmin("  OWNER@EXAMPLE.COM ", PASSWORD)).ok).toBe(
      true,
    );
  });

  it("rejects a wrong password", async () => {
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const result = await authenticateAdmin(EMAIL, "wrong");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports an unknown account identically to a wrong password", async () => {
    // A distinct reason here would enumerate valid admin addresses.
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    expect(await authenticateAdmin("nobody@example.com", PASSWORD)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("spends comparable time on an unknown account as on a wrong password", async () => {
    // The timing defence: without the dummy hash, "no such user" returns in
    // microseconds while "wrong password" costs ~100ms of scrypt.
    const { authenticateAdmin } = await import("@/lib/server/auth/login");

    // Warm the lazily-computed dummy hash so it is not counted.
    await authenticateAdmin("warmup@example.com", "x");

    const unknownStart = performance.now();
    await authenticateAdmin("nobody@example.com", PASSWORD);
    const unknownMs = performance.now() - unknownStart;

    const wrongStart = performance.now();
    await authenticateAdmin(EMAIL, "wrong-password");
    const wrongMs = performance.now() - wrongStart;

    // Generous bound: the point is the same order of magnitude, not equality.
    // Without the defence the ratio is hundreds to one.
    expect(unknownMs).toBeGreaterThan(wrongMs / 5);
  });

  it("increments the failure counter", async () => {
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const { adminUsers } = await import("@/lib/server/db/collections");

    await authenticateAdmin(EMAIL, "wrong");
    await authenticateAdmin(EMAIL, "wrong");

    const users = await adminUsers();
    expect((await users.findOne({ email: EMAIL }))?.failedAttempts).toBe(2);
  });

  it("locks the account after five failures", async () => {
    const { authenticateAdmin, LOGIN_LIMITS } =
      await import("@/lib/server/auth/login");

    for (
      let attempt = 0;
      attempt < LOGIN_LIMITS.maxFailedAttempts;
      attempt += 1
    ) {
      expect((await authenticateAdmin(EMAIL, "wrong")).ok).toBe(false);
    }

    const locked = await authenticateAdmin(EMAIL, PASSWORD);
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.reason).toBe("locked");
      if (locked.reason === "locked") {
        expect(locked.retryAfterSeconds).toBeGreaterThan(0);
        expect(locked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
      }
    }
  });

  it("refuses the correct password while locked", async () => {
    // The whole point of the lockout: guessing must not be rescued by finally
    // getting it right on attempt six.
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authenticateAdmin(EMAIL, "wrong");
    }
    const result = await authenticateAdmin(EMAIL, PASSWORD);
    expect(result.ok).toBe(false);
  });

  it("accepts the correct password once the lockout expires", async () => {
    const { authenticateAdmin, LOGIN_LIMITS } =
      await import("@/lib/server/auth/login");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authenticateAdmin(EMAIL, "wrong");
    }

    const later = new Date(Date.now() + LOGIN_LIMITS.lockoutMs + 1_000);
    expect(
      (await authenticateAdmin(EMAIL, PASSWORD, undefined, later)).ok,
    ).toBe(true);
  });

  it("resets the counter on a successful sign-in", async () => {
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const { adminUsers } = await import("@/lib/server/db/collections");

    await authenticateAdmin(EMAIL, "wrong");
    await authenticateAdmin(EMAIL, "wrong");
    await authenticateAdmin(EMAIL, PASSWORD);

    const users = await adminUsers();
    const user = await users.findOne({ email: EMAIL });
    expect(user?.failedAttempts).toBe(0);
    expect(user?.lockedUntil).toBeNull();
    expect(user?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("refuses a disabled account, but only after the password verifies", async () => {
    // Checking status first would let an attacker identify disabled accounts
    // without knowing their password.
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    await seedUser({ status: "disabled" });

    expect(await authenticateAdmin(EMAIL, PASSWORD)).toEqual({
      ok: false,
      reason: "disabled",
    });
    expect(await authenticateAdmin(EMAIL, "wrong")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("asks for a second factor when two-factor auth is enabled", async () => {
    const { generateTotpSecret } = await import("@/lib/server/auth/totp");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const secret = generateTotpSecret();
    await seedUser({ totpSecret: secret, totpEnabledAt: new Date() });

    expect(await authenticateAdmin(EMAIL, PASSWORD)).toEqual({
      ok: false,
      reason: "two-factor-required",
    });
  });

  it("accepts a valid second factor", async () => {
    const { generateTotp, generateTotpSecret } =
      await import("@/lib/server/auth/totp");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const secret = generateTotpSecret();
    await seedUser({ totpSecret: secret, totpEnabledAt: new Date() });

    const now = new Date();
    const result = await authenticateAdmin(
      EMAIL,
      PASSWORD,
      generateTotp(secret, now.getTime()),
      now,
    );
    expect(result.ok).toBe(true);
  });

  it("counts a wrong second factor towards the lockout", async () => {
    // Otherwise a six-digit code could be brute-forced against a known password.
    const { generateTotpSecret } = await import("@/lib/server/auth/totp");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const { adminUsers } = await import("@/lib/server/db/collections");
    await seedUser({
      totpSecret: generateTotpSecret(),
      totpEnabledAt: new Date(),
    });

    expect(await authenticateAdmin(EMAIL, PASSWORD, "000000")).toEqual({
      ok: false,
      reason: "invalid",
    });

    const users = await adminUsers();
    expect((await users.findOne({ email: EMAIL }))?.failedAttempts).toBe(1);
  });

  it("ignores a stored secret until two-factor is actually enabled", async () => {
    // A secret is written during setup, before the user confirms a code. It must
    // not start gating sign-in halfway through that flow.
    const { generateTotpSecret } = await import("@/lib/server/auth/totp");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    await seedUser({ totpSecret: generateTotpSecret(), totpEnabledAt: null });

    expect((await authenticateAdmin(EMAIL, PASSWORD)).ok).toBe(true);
  });
});

describeWithDatabase("changeAdminPassword", () => {
  useTestDatabase();

  it("invalidates every existing session by bumping the epoch", async () => {
    const { adminUsers } = await import("@/lib/server/db/collections");
    const { hashPassword } = await import("@/lib/server/crypto");
    const { changeAdminPassword, authenticateAdmin } =
      await import("@/lib/server/auth/login");

    const users = await adminUsers();
    await users.deleteMany({});
    const now = new Date();
    const inserted = await users.insertOne({
      email: "rotate@example.com",
      name: "Rotate",
      role: "admin",
      passwordHash: await hashPassword("Old-Password-123!"),
      status: "active",
      totpSecret: null,
      totpEnabledAt: null,
      failedAttempts: 3,
      lockedUntil: null,
      lastLoginAt: null,
      sessionEpoch: 1,
      createdAt: now,
      updatedAt: now,
    } as never);

    await changeAdminPassword(
      inserted.insertedId.toHexString(),
      "New-Password-456!",
    );

    const updated = await users.findOne({ email: "rotate@example.com" });
    // The epoch bump is what makes the invalidation total — including any
    // session an attacker had already stolen.
    expect(updated?.sessionEpoch).toBe(2);
    expect(updated?.failedAttempts).toBe(0);

    expect(
      (await authenticateAdmin("rotate@example.com", "New-Password-456!")).ok,
    ).toBe(true);
    expect(
      (await authenticateAdmin("rotate@example.com", "Old-Password-123!")).ok,
    ).toBe(false);
  });
});
