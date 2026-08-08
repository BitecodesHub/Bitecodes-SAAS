import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { GoogleIdentity } from "@/lib/server/auth/google-oauth";

/**
 * The account-linking policy.
 *
 * This is where social sign-in is usually broken into, so each rule is pinned
 * separately rather than through one happy path. The three that matter: an
 * unverified Google address links to nothing, staff cannot sign in this way,
 * and the subject rather than the address is the identity.
 */
describeWithDatabase("signing in with Google", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { adminUsers, walletBalances, walletLedger } =
      await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
  });

  const IDENTITY: GoogleIdentity = {
    subject: "google-sub-1",
    email: "asha@example.com",
    emailVerified: true,
    name: "Asha Mehta",
    picture: null,
  };

  async function signIn(overrides: Partial<GoogleIdentity> = {}) {
    const { signInWithGoogle } =
      await import("@/lib/server/auth/google-account");
    return signInWithGoogle({ ...IDENTITY, ...overrides });
  }

  async function userByEmail(email: string) {
    const { adminUsers } = await import("@/lib/server/db/collections");
    return (await adminUsers()).findOne({ email });
  }

  async function seed(doc: Record<string, unknown>) {
    const { adminUsers } = await import("@/lib/server/db/collections");
    const now = new Date();
    const result = await (
      await adminUsers()
    ).insertOne({
      email: "asha@example.com",
      name: "Asha",
      role: "customer",
      passwordHash: "x",
      status: "active",
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      sessionEpoch: 1,
      createdAt: now,
      updatedAt: now,
      ...doc,
    } as never);
    return result.insertedId.toHexString();
  }

  it("creates a verified, funded customer for a new identity", async () => {
    const { SIGNUP_BONUS } = await import("@/lib/server/auth/signup");
    const { getBalance } = await import("@/lib/server/wallet/wallet");

    const outcome = await signIn();
    expect(outcome).toMatchObject({
      ok: true,
      created: true,
      role: "customer",
    });
    if (!outcome.ok) return;

    const user = await userByEmail("asha@example.com");
    expect(user?.status).toBe("active");
    expect(user?.googleSub).toBe("google-sub-1");
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    // No email confirmation is sent or needed: Google has just proven it.
    expect(await getBalance(outcome.userId, "chatbot")).toBe(
      SIGNUP_BONUS.chatbot,
    );
  });

  it("gives a Google-created account an unusable password", async () => {
    // The hash must not be blank, fixed, or shared between accounts — any of
    // those is a password once somebody works out what produces it.
    await signIn();
    const first = await userByEmail("asha@example.com");

    const { adminUsers } = await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await signIn({ subject: "google-sub-2" });
    const second = await userByEmail("asha@example.com");

    expect(first?.passwordHash).toBeTruthy();
    expect(first?.passwordHash).not.toBe(second?.passwordHash);

    const { verifyPassword } = await import("@/lib/server/crypto");
    for (const guess of ["", " ", "password", "google", "asha@example.com"]) {
      expect(await verifyPassword(guess, first!.passwordHash), guess).toBe(
        false,
      );
    }
  });

  it("signs the same identity back in without creating a second account", async () => {
    const first = await signIn();
    const second = await signIn();

    expect(second).toMatchObject({ ok: true, created: false });
    if (first.ok && second.ok) expect(second.userId).toBe(first.userId);

    const { adminUsers } = await import("@/lib/server/db/collections");
    expect(await (await adminUsers()).countDocuments({})).toBe(1);
  });

  it("pays the welcome credits once, not on every sign-in", async () => {
    const { SIGNUP_BONUS } = await import("@/lib/server/auth/signup");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const outcome = await signIn();
    await signIn();
    await signIn();
    if (!outcome.ok) throw new Error("expected success");
    expect(await getBalance(outcome.userId, "forms")).toBe(SIGNUP_BONUS.forms);
  });

  it("follows the subject, not the address, when the address changes", async () => {
    // Google states the address on an account can change and `sub` cannot.
    const first = await signIn();
    const renamed = await signIn({ email: "asha.mehta@example.com" });

    expect(renamed).toMatchObject({ ok: true, created: false });
    if (first.ok && renamed.ok) expect(renamed.userId).toBe(first.userId);
    const { adminUsers } = await import("@/lib/server/db/collections");
    expect(await (await adminUsers()).countDocuments({})).toBe(1);
  });

  it("refuses an unverified Google address, and creates nothing", async () => {
    // The takeover this prevents: register a Google identity asserting somebody
    // else's address, press the button, inherit their account.
    const outcome = await signIn({ emailVerified: false });
    expect(outcome).toEqual({ ok: false, reason: "unverified-email" });

    const { adminUsers } = await import("@/lib/server/db/collections");
    expect(await (await adminUsers()).countDocuments({})).toBe(0);
  });

  it("refuses an unverified address even when an account already exists", async () => {
    await seed({});
    const outcome = await signIn({ emailVerified: false });
    expect(outcome).toEqual({ ok: false, reason: "unverified-email" });
    expect(
      (await userByEmail("asha@example.com"))?.googleSub ?? null,
    ).toBeNull();
  });

  it("links onto an existing password account and keeps its data", async () => {
    const userId = await seed({ name: "Asha Mehta", company: "Mehta Dental" });
    const outcome = await signIn();

    expect(outcome).toMatchObject({ ok: true, created: false });
    if (outcome.ok) expect(outcome.userId).toBe(userId);
    const user = await userByEmail("asha@example.com");
    expect(user?.googleSub).toBe("google-sub-1");
    expect(user?.company).toBe("Mehta Dental");
  });

  it("activates and funds a pending account, since Google proved the address", async () => {
    const { SIGNUP_BONUS } = await import("@/lib/server/auth/signup");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const userId = await seed({ status: "pending", emailVerifiedAt: null });

    const outcome = await signIn();
    expect(outcome).toMatchObject({ ok: true });
    expect((await userByEmail("asha@example.com"))?.status).toBe("active");
    expect(await getBalance(userId, "bookings")).toBe(SIGNUP_BONUS.bookings);
  });

  it("refuses every staff role", async () => {
    for (const role of ["owner", "admin", "editor", "viewer"] as const) {
      const { adminUsers } = await import("@/lib/server/db/collections");
      await (await adminUsers()).deleteMany({});
      await seed({ role });

      const outcome = await signIn();
      expect(outcome, role).toEqual({ ok: false, reason: "staff-account" });
      // Nothing was linked, so a later attempt cannot succeed by subject either.
      expect(
        (await userByEmail("asha@example.com"))?.googleSub ?? null,
        role,
      ).toBeNull();
    }
  });

  it("refuses a disabled account", async () => {
    await seed({ status: "disabled", googleSub: "google-sub-1" });
    expect(await signIn()).toEqual({ ok: false, reason: "disabled" });
  });

  it("refuses to move an account to a second Google identity", async () => {
    await seed({ googleSub: "google-sub-1" });
    const outcome = await signIn({ subject: "google-sub-2" });

    expect(outcome).toEqual({ ok: false, reason: "already-linked" });
    expect((await userByEmail("asha@example.com"))?.googleSub).toBe(
      "google-sub-1",
    );
  });

  it("refuses a staff account even once it somehow carries a subject", async () => {
    // Defence in depth: the role is re-checked on the by-subject path, so a row
    // written by hand or by a future migration cannot open the panel.
    await seed({ role: "owner", googleSub: "google-sub-1" });
    expect(await signIn()).toEqual({ ok: false, reason: "staff-account" });
  });
});

/**
 * Pre-hijack: the attack where somebody registers an account against an address
 * they do not own, waits for the real owner to sign in with Google, and then
 * uses the password they set at registration.
 */
describeWithDatabase("pre-hijack via a planted pending account", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { adminUsers, adminSessions, walletBalances, walletLedger } =
      await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await (await adminSessions()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
  });

  it("stops the planted password working once Google claims the account", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    const { signInWithGoogle } =
      await import("@/lib/server/auth/google-account");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");

    // 1. The attacker registers the victim's address with a password of their
    //    choosing. Sign-up is non-enumerating, so this always "succeeds".
    const planted = "Attacker-Knows-This-1!";
    await signUpCustomer({
      name: "Not The Victim",
      email: "victim@example.com",
      password: planted,
    });

    // The planted password does not work yet: the account is unverified.
    const before = await authenticateAdmin("victim@example.com", planted);
    expect(before.ok).toBe(false);

    // 2. The victim, who owns the address, signs in with Google.
    const outcome = await signInWithGoogle({
      subject: "victim-google-sub",
      email: "victim@example.com",
      emailVerified: true,
      name: "The Victim",
      picture: null,
    });
    expect(outcome.ok).toBe(true);

    // 3. The attacker tries the password they planted. Activating the account
    //    must not have handed it to them.
    const after = await authenticateAdmin("victim@example.com", planted);
    expect(after.ok, "planted password must not survive the Google link").toBe(
      false,
    );
  });

  it("evicts any session the pre-registrant already held", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    const { signInWithGoogle } =
      await import("@/lib/server/auth/google-account");
    const { adminUsers, adminSessions } =
      await import("@/lib/server/db/collections");

    await signUpCustomer({
      name: "Not The Victim",
      email: "victim@example.com",
      password: "Attacker-Knows-This-1!",
    });
    const user = await (
      await adminUsers()
    ).findOne({
      email: "victim@example.com",
    });
    const userId = user!._id!.toHexString();

    // A session issued against the pre-registration, however it was obtained.
    const { issueAdminSession } = await import("@/lib/server/auth/session");
    await issueAdminSession({
      userId,
      role: "customer",
      sessionEpoch: user!.sessionEpoch,
      ip: null,
      userAgent: null,
    });

    await signInWithGoogle({
      subject: "victim-google-sub",
      email: "victim@example.com",
      emailVerified: true,
      name: "The Victim",
      picture: null,
    });

    const live = await (
      await adminSessions()
    ).countDocuments({
      userId,
      revokedAt: null,
    });
    expect(live, "sessions predating the link must be revoked").toBe(0);
  });

  it("leaves a genuine password alone when the account was already verified", async () => {
    // The mirror case. Somebody who proved their own address and later adds
    // Google must keep the password they chose.
    const { signUpCustomer, verifyEmail } =
      await import("@/lib/server/auth/signup");
    const { signInWithGoogle } =
      await import("@/lib/server/auth/google-account");
    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const { adminUsers, adminTokens } =
      await import("@/lib/server/db/collections");
    const { randomToken, sha256Hex } = await import("@/lib/server/crypto");

    const mine = "My-Own-Password-7!";
    await signUpCustomer({
      name: "Real Owner",
      email: "owner@example.com",
      password: mine,
    });
    const user = await (
      await adminUsers()
    ).findOne({
      email: "owner@example.com",
    });
    const token = randomToken(32);
    await (
      await adminTokens()
    ).insertOne({
      tokenHash: sha256Hex(token),
      userId: user!._id!.toHexString(),
      purpose: "verify-email",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    await verifyEmail(token);

    await signInWithGoogle({
      subject: "owner-google-sub",
      email: "owner@example.com",
      emailVerified: true,
      name: "Real Owner",
      picture: null,
    });

    const after = await authenticateAdmin("owner@example.com", mine);
    expect(after.ok, "a proven owner keeps their password").toBe(true);
  });
});
