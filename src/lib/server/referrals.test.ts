import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Referrals pay real credits, so the tests pin the two properties that make
 * that safe: a reward happens only after the referred account proves its email,
 * and it happens exactly once however many times qualification is attempted.
 */
describeWithDatabase("referrals", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { referrals, walletBalances, walletLedger } =
      await import("@/lib/server/db/collections");
    await (await referrals()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
  });

  it("creates one code per account, even on repeated views", async () => {
    const { getOrCreateReferral, normalizeReferralCode } =
      await import("@/lib/server/referrals");

    const first = await getOrCreateReferral("owner-1");
    const second = await getOrCreateReferral("owner-1");

    expect(second.code).toBe(first.code);
    expect(normalizeReferralCode(first.code)).toBe(first.code);
  });

  it("records a signup but pays nothing until the address is verified", async () => {
    const { getOrCreateReferral, registerReferralSignup } =
      await import("@/lib/server/referrals");
    const { getBalance } = await import("@/lib/server/wallet/wallet");

    const referral = await getOrCreateReferral("referrer-1");
    const recorded = await registerReferralSignup(referral.code, "referred-1");

    expect(recorded).toBe(true);
    expect(await getBalance("referrer-1", "chatbot")).toBe(0);

    const duplicate = await registerReferralSignup(referral.code, "referred-1");
    expect(duplicate).toBe(false);
  });

  it("ignores malformed, unknown, and self-referential codes", async () => {
    const { getOrCreateReferral, registerReferralSignup } =
      await import("@/lib/server/referrals");

    const referral = await getOrCreateReferral("referrer-1");

    expect(await registerReferralSignup("not-a-code", "referred-1")).toBe(
      false,
    );
    expect(await registerReferralSignup("BC-ZZZZZZ", "referred-1")).toBe(false);
    expect(
      await registerReferralSignup(referral.code, referral.referrerId),
    ).toBe(false);
  });

  it("rewards once on qualification and is idempotent", async () => {
    const {
      getOrCreateReferral,
      registerReferralSignup,
      qualifyReferralForUser,
      REFERRAL_REWARD,
    } = await import("@/lib/server/referrals");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { referrals } = await import("@/lib/server/db/collections");

    const referral = await getOrCreateReferral("referrer-1");
    await registerReferralSignup(referral.code, "referred-1");

    expect(await qualifyReferralForUser("referred-1")).toBe(true);
    expect(await getBalance("referrer-1", REFERRAL_REWARD.product)).toBe(
      REFERRAL_REWARD.amount,
    );

    // A retried verification click must not pay a second time.
    expect(await qualifyReferralForUser("referred-1")).toBe(false);
    expect(await getBalance("referrer-1", REFERRAL_REWARD.product)).toBe(
      REFERRAL_REWARD.amount,
    );

    const stored = await (
      await referrals()
    ).findOne({
      referrerId: "referrer-1",
    });
    expect(stored?.redemptions[0]?.qualifiedAt).toBeInstanceOf(Date);
    expect(stored?.redemptions[0]?.rewardedAt).toBeInstanceOf(Date);
  });

  it("reconciles a qualified reward that was never paid", async () => {
    const {
      getOrCreateReferral,
      registerReferralSignup,
      reconcileReferralRewards,
      REFERRAL_REWARD,
    } = await import("@/lib/server/referrals");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { referrals } = await import("@/lib/server/db/collections");

    const referral = await getOrCreateReferral("referrer-1");
    await registerReferralSignup(referral.code, "referred-1");

    // Simulate the crash window: qualified, but the credit never landed.
    const qualifiedAt = new Date(Date.now() - 60 * 60 * 1000);
    await (
      await referrals()
    ).updateOne(
      { referrerId: "referrer-1" },
      { $set: { "redemptions.0.qualifiedAt": qualifiedAt } },
    );

    const summary = await reconcileReferralRewards();
    expect(summary.rewarded).toBe(1);
    expect(await getBalance("referrer-1", REFERRAL_REWARD.product)).toBe(
      REFERRAL_REWARD.amount,
    );

    // A second pass has nothing left to do and cannot double-pay.
    const again = await reconcileReferralRewards();
    expect(again.rewarded).toBe(0);
    expect(await getBalance("referrer-1", REFERRAL_REWARD.product)).toBe(
      REFERRAL_REWARD.amount,
    );
  });
});
