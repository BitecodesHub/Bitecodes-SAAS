import "server-only";

import { referrals } from "@/lib/server/db/collections";
import type { ReferralDoc, WalletProduct } from "@/lib/server/db/types";
import { credit, hasCreditRef } from "@/lib/server/wallet/wallet";

/**
 * Customer referrals.
 *
 * The flow has three states per redemption, and each exists for a reason:
 *
 *  1. **signed up** — recorded when a *new* account is created with a valid
 *     code. The account is still `pending` at this point, so nothing is paid.
 *  2. **qualified** — set when that account proves its email address. This is
 *     the point at which a referral becomes real: a script that posts a
 *     thousand sign-ups creates a thousand rows that cannot sign in, and none
 *     of them can trigger a reward.
 *  3. **rewarded** — the referrer's credits have been journalled. Marked only
 *     after `credit()` succeeds, so a crash cannot lose the reward; a daily
 *     reconciliation job finishes anything that was left qualified but unpaid.
 *
 * Redemption identity is the account id, never the email address. The email is
 * mutable and is personal data; the id is stable and is already the foreign key
 * every other collection uses.
 */

/** Same alphabet as the code generator: no I/O/0/1 confusion when read aloud. */
const REFERRAL_CODE_PATTERN = /^BC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/**
 * What a referrer receives once a referred account verifies its email.
 *
 * Chatbot tokens are the flagship unit; 50 answers is enough to demonstrate the
 * product to somebody who was sent here by a friend. Kept here rather than in
 * the signup bonus table because the two are different promises.
 */
export const REFERRAL_REWARD: { product: WalletProduct; amount: number } = {
  product: "chatbot",
  // 500 tokens per answer, the same ratio `/signup` uses.
  amount: 50 * 500,
};

export const REFERRAL_REWARD_DESCRIPTION = "50 chatbot replies";

/** A reward this old may be reconciled without racing a live request. */
const RECONCILE_AFTER_MS = 10 * 60 * 1000;

export function normalizeReferralCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export function generateReferralCode(existingCodes: Set<string>): string {
  const prefix = "BC-";
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;

  do {
    const suffix = Array.from({ length: 6 })
      .map(() => characters[Math.floor(Math.random() * characters.length)])
      .join("");
    code = prefix + suffix;
  } while (existingCodes.has(code));

  return code;
}

/**
 * The account's own code, created on first view.
 *
 * The unique index on `referrerId` is what makes this safe under two dashboard
 * loads arriving together: both may try to insert, one wins, and the loser
 * re-reads the winner's document. The code itself is not collision-checked
 * against the whole collection — the unique index on `code` rejects a duplicate
 * and the loop retries with a fresh random value.
 */
export async function getOrCreateReferral(
  referrerId: string,
): Promise<ReferralDoc> {
  const collection = await referrals();

  const existing = await collection.findOne({ referrerId });
  if (existing) return existing;

  const now = new Date();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const document: ReferralDoc = {
      code: generateReferralCode(new Set()),
      referrerId,
      status: "active",
      redemptions: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      await collection.insertOne(document);
      return document;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;

      const raced = await collection.findOne({ referrerId });
      if (raced) return raced;
      // Otherwise the collision was on `code`; try another one.
    }
  }

  throw new Error("could not allocate a unique referral code");
}

/**
 * Attributes a new account to a code. Returns false for an unknown, disabled,
 * malformed, or self-referential code — all of which are ordinary misses, not
 * errors the signup should surface.
 */
export async function registerReferralSignup(
  rawCode: string,
  referredId: string,
): Promise<boolean> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return false;

  const collection = await referrals();
  const referral = await collection.findOne(
    { code, status: "active" },
    { projection: { _id: 1, referrerId: 1 } },
  );
  if (!referral?._id || referral.referrerId === referredId) return false;

  const now = new Date();
  const result = await collection.updateOne(
    {
      _id: referral._id,
      status: "active",
      // The filter makes this atomic: a retry for the same account cannot add a
      // second redemption, and the `$slice` keeps one abusive account from
      // growing the document without bound.
      "redemptions.referredId": { $ne: referredId },
    },
    {
      $push: {
        redemptions: {
          $each: [
            {
              referredId,
              signedUpAt: now,
              qualifiedAt: null,
              rewardedAt: null,
            },
          ],
          $slice: -200,
        },
      },
      $set: { updatedAt: now },
    },
  );

  return result.modifiedCount === 1;
}

/**
 * Marks a referred account as verified and pays the referrer.
 *
 * `qualifiedAt` is set with an array filter that matches only an unqualified
 * row, so exactly one caller — the verification click, or a retry of it — can
 * make the transition. Payment is idempotent on its own (`hasCreditRef` plus a
 * `refId` unique to this redemption), which means a crash between crediting and
 * marking cannot double-pay on the retry.
 */
export async function qualifyReferralForUser(
  referredId: string,
): Promise<boolean> {
  const collection = await referrals();
  const now = new Date();

  const referral = await collection.findOne(
    {
      status: "active",
      redemptions: {
        $elemMatch: { referredId, qualifiedAt: null },
      },
    },
    { projection: { _id: 1, referrerId: 1 } },
  );
  if (!referral?._id) return false;

  const marked = await collection.updateOne(
    { _id: referral._id },
    {
      $set: {
        "redemptions.$[redemption].qualifiedAt": now,
        updatedAt: now,
      },
    },
    {
      arrayFilters: [
        { "redemption.referredId": referredId, "redemption.qualifiedAt": null },
      ],
    },
  );
  if (marked.modifiedCount !== 1) return false;

  await rewardRedemption(referral._id, referral.referrerId, referredId, now);
  return true;
}

/** Pays one qualified redemption, marking it only after the credit lands. */
async function rewardRedemption(
  referralId: NonNullable<ReferralDoc["_id"]>,
  referrerId: string,
  referredId: string,
  now: Date,
): Promise<boolean> {
  const refId = `referral:${referralId.toHexString()}:${referredId}`;

  if (!(await hasCreditRef(referrerId, REFERRAL_REWARD.product, refId))) {
    await credit({
      ownerId: referrerId,
      product: REFERRAL_REWARD.product,
      amount: REFERRAL_REWARD.amount,
      kind: "bonus",
      refId,
      note: `referral:${referredId}`,
      now,
    });
  }

  const collection = await referrals();
  const marked = await collection.updateOne(
    { _id: referralId },
    {
      $set: {
        "redemptions.$[redemption].rewardedAt": now,
        updatedAt: now,
      },
    },
    {
      arrayFilters: [
        { "redemption.referredId": referredId, "redemption.rewardedAt": null },
      ],
    },
  );

  return marked.modifiedCount === 1;
}

export interface ReferralReconcileSummary {
  checked: number;
  rewarded: number;
  failed: number;
}

/**
 * Finishes redemptions that qualified but were never paid — the recovery half
 * of the crash-safety contract above. Only rows older than the grace period are
 * considered, so a reconciliation run cannot race the verification request that
 * is paying the same reward right now.
 */
export async function reconcileReferralRewards(
  now = new Date(),
): Promise<ReferralReconcileSummary> {
  const collection = await referrals();
  const cutoff = new Date(now.getTime() - RECONCILE_AFTER_MS);

  const due = await collection
    .find({
      redemptions: {
        $elemMatch: {
          qualifiedAt: { $lt: cutoff },
          rewardedAt: null,
        },
      },
    })
    .limit(200)
    .toArray();

  let rewarded = 0;
  let failed = 0;

  for (const referral of due) {
    if (!referral._id) continue;
    for (const redemption of referral.redemptions) {
      if (
        redemption.qualifiedAt === null ||
        redemption.rewardedAt !== null ||
        redemption.qualifiedAt.getTime() >= cutoff.getTime()
      ) {
        continue;
      }
      try {
        const paid = await rewardRedemption(
          referral._id,
          referral.referrerId,
          redemption.referredId,
          now,
        );
        if (paid) rewarded += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { checked: due.length, rewarded, failed };
}
