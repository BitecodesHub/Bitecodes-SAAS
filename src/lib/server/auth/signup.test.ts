import { beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Sign-up is the only place on the site where an anonymous visitor creates a
 * record, sends mail from our domain to an address of their choosing, and — on
 * verification — is handed something worth money. Each of those is a way to be
 * abused, and each has a rule here.
 */
/**
 * `vi.mock` factories are hoisted above every other statement in the file, so
 * the outbox they write to has to be hoisted with them — a plain `const` in the
 * describe block is not yet initialised when the factory runs.
 */
const outbox = vi.hoisted(() => [] as { to: string; subject: string }[]);

vi.mock("@/lib/server/email/send", () => ({
  // Recorded rather than sent: the assertions below care which address was
  // written to and what it was told, never that SMTP was reachable.
  queueEmail: vi.fn(async (input: { to: string; subject: string }) => {
    outbox.push({ to: input.to, subject: input.subject });
    return { messageId: "test", status: "queued" as const };
  }),
}));

describeWithDatabase("self-serve sign-up", () => {
  useTestDatabase();

  const sent = outbox;

  beforeEach(async () => {
    sent.length = 0;
    const { adminUsers, adminTokens, walletBalances, walletLedger } =
      await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await (await adminTokens()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
  });

  const GOOD = {
    name: "Priya Raman",
    email: "priya@example.com",
    password: "Correct-Horse-9!",
  };

  async function tokenFor(userId: string): Promise<string> {
    // The plaintext token never leaves `sendVerificationEmail`, so tests mint
    // their own the same way the module does and store the matching hash.
    const { adminTokens } = await import("@/lib/server/db/collections");
    const { randomToken, sha256Hex } = await import("@/lib/server/crypto");
    const token = randomToken(32);
    await (
      await adminTokens()
    ).insertOne({
      tokenHash: sha256Hex(token),
      userId,
      purpose: "verify-email",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    return token;
  }

  async function userByEmail(email: string) {
    const { adminUsers } = await import("@/lib/server/db/collections");
    return (await adminUsers()).findOne({ email });
  }

  it("creates a pending customer that cannot yet sign in", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    expect(await signUpCustomer(GOOD)).toEqual({ ok: true });

    const user = await userByEmail("priya@example.com");
    expect(user?.role).toBe("customer");
    expect(user?.status).toBe("pending");
    expect(user?.emailVerifiedAt ?? null).toBeNull();

    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const attempt = await authenticateAdmin(GOOD.email, GOOD.password);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("unverified");
  });

  it("grants nothing until the address is proven", async () => {
    const { signUpCustomer, SIGNUP_BONUS } =
      await import("@/lib/server/auth/signup");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    await signUpCustomer(GOOD);

    const user = await userByEmail(GOOD.email);
    const userId = user!._id!.toHexString();
    expect(await getBalance(userId, "chatbot")).toBe(0);

    const { verifyEmail } = await import("@/lib/server/auth/signup");
    const outcome = await verifyEmail(await tokenFor(userId));
    expect(outcome).toMatchObject({ ok: true, granted: true });
    expect(await getBalance(userId, "chatbot")).toBe(SIGNUP_BONUS.chatbot);
    expect(await getBalance(userId, "forms")).toBe(SIGNUP_BONUS.forms);
    expect(await getBalance(userId, "bookings")).toBe(SIGNUP_BONUS.bookings);
    expect(await getBalance(userId, "email")).toBe(SIGNUP_BONUS.email);
  });

  it("does not pay the welcome credits twice", async () => {
    const { signUpCustomer, verifyEmail, SIGNUP_BONUS } =
      await import("@/lib/server/auth/signup");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    await signUpCustomer(GOOD);
    const userId = (await userByEmail(GOOD.email))!._id!.toHexString();

    await verifyEmail(await tokenFor(userId));
    // A second, independently valid link — the case a single-use token alone
    // does not cover, because the person may have been sent two.
    const second = await verifyEmail(await tokenFor(userId));

    expect(second).toMatchObject({ ok: true, granted: false });
    expect(await getBalance(userId, "chatbot")).toBe(SIGNUP_BONUS.chatbot);
  });

  it("answers a taken address exactly as it answers a new one", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    const first = await signUpCustomer(GOOD);
    sent.length = 0;

    const second = await signUpCustomer({ ...GOOD, name: "Someone Else" });

    // Identical results: the form cannot be used to test whether an address is
    // registered.
    expect(second).toEqual(first);
    // Exactly one account, and the name was not overwritten by the second try.
    const { adminUsers } = await import("@/lib/server/db/collections");
    expect(await (await adminUsers()).countDocuments({})).toBe(1);
    expect((await userByEmail(GOOD.email))?.name).toBe("Priya Raman");
    // The inbox owner is told, even though the form's visitor was not.
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(GOOD.email);
    expect(sent[0]!.subject).toMatch(/already have/i);
  });

  it("treats a taken address case-insensitively", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    await signUpCustomer(GOOD);
    await signUpCustomer({ ...GOOD, email: "  PRIYA@Example.COM " });

    const { adminUsers } = await import("@/lib/server/db/collections");
    expect(await (await adminUsers()).countDocuments({})).toBe(1);
  });

  it("refuses a weak password before writing anything", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    const result = await signUpCustomer({ ...GOOD, password: "password" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("password");
    const { adminUsers } = await import("@/lib/server/db/collections");
    expect(await (await adminUsers()).countDocuments({})).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("refuses an undeliverable address", async () => {
    const { signUpCustomer } = await import("@/lib/server/auth/signup");
    for (const email of ["nope", "a@b", "no-at-sign.com", "x@y..com"]) {
      const result = await signUpCustomer({ ...GOOD, email });
      expect(result.ok, email).toBe(false);
      if (!result.ok) expect(result.field, email).toBe("email");
    }
    expect(sent).toHaveLength(0);
  });

  it("rejects a verification token that was never issued", async () => {
    const { verifyEmail } = await import("@/lib/server/auth/signup");
    expect(await verifyEmail("not-a-real-token")).toEqual({
      ok: false,
      reason: "invalid-token",
    });
    expect(await verifyEmail("")).toEqual({
      ok: false,
      reason: "invalid-token",
    });
  });

  it("will not accept a password-reset token as proof of an address", async () => {
    // Purpose is part of the lookup, so a token minted for one flow cannot be
    // spent in another.
    const { signUpCustomer, verifyEmail } =
      await import("@/lib/server/auth/signup");
    await signUpCustomer(GOOD);
    const userId = (await userByEmail(GOOD.email))!._id!.toHexString();

    const { adminTokens } = await import("@/lib/server/db/collections");
    const { randomToken, sha256Hex } = await import("@/lib/server/crypto");
    const token = randomToken(32);
    await (
      await adminTokens()
    ).insertOne({
      tokenHash: sha256Hex(token),
      userId,
      purpose: "password-reset",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    expect(await verifyEmail(token)).toEqual({
      ok: false,
      reason: "invalid-token",
    });
    expect((await userByEmail(GOOD.email))?.status).toBe("pending");
  });

  it("signs in once verified", async () => {
    const { signUpCustomer, verifyEmail } =
      await import("@/lib/server/auth/signup");
    await signUpCustomer(GOOD);
    const userId = (await userByEmail(GOOD.email))!._id!.toHexString();
    await verifyEmail(await tokenFor(userId));

    const { authenticateAdmin } = await import("@/lib/server/auth/login");
    const attempt = await authenticateAdmin(GOOD.email, GOOD.password);
    expect(attempt.ok).toBe(true);
    if (attempt.ok) expect(attempt.role).toBe("customer");
  });

  it("resends only to a pending account, and silently", async () => {
    const { signUpCustomer, verifyEmail, resendVerification } =
      await import("@/lib/server/auth/signup");
    await signUpCustomer(GOOD);
    sent.length = 0;

    await resendVerification(GOOD.email);
    expect(sent).toHaveLength(1);

    // Once verified there is nothing to resend, and an unknown address must be
    // indistinguishable from a verified one.
    const userId = (await userByEmail(GOOD.email))!._id!.toHexString();
    await verifyEmail(await tokenFor(userId));
    sent.length = 0;

    await resendVerification(GOOD.email);
    await resendVerification("stranger@example.com");
    expect(sent).toHaveLength(0);
  });
});
