import "server-only";

import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";
import type { ReferralDoc } from "@/lib/server/db/types";

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

export async function createReferral(
  referrerId: string,
  existingCodes: Set<string>,
): Promise<ReferralDoc> {
  const db = await getDatabase();
  const code = generateReferralCode(existingCodes);
  const now = new Date();

  const referral: ReferralDoc = {
    code,
    referrerId,
    status: "active",
    redemptions: [],
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.referrals).insertOne(referral);

  return referral;
}

export async function recordReferralRedemption(
  referralId: string,
  referredId: string,
): Promise<void> {
  const db = await getDatabase();

  await db.collection<ReferralDoc>(COLLECTIONS.referrals).updateOne(
    { _id: new ObjectId(referralId) },
    {
      $push: {
        redemptions: {
          referredId,
          signedUpAt: new Date(),
          qualifiedAt: null,
          rewardedAt: null,
        },
      },
    },
  );
}

export async function grantReferralRewardIfEligible(
  referralId: string,
  context: { log: (msg: string) => void },
): Promise<{ rewarded: boolean; reason?: string }> {
  const db = await getDatabase();

  const referral = await db.collection(COLLECTIONS.referrals).findOne({
    _id: new ObjectId(referralId),
  });

  if (!referral) {
    return { rewarded: false, reason: "referral not found" };
  }

  const { redemptions } = referral;
  const qualified = redemptions.filter(
    (r: { qualifiedAt: Date | null; rewardedAt: Date | null }) =>
      r.qualifiedAt !== null && r.rewardedAt === null,
  );

  if (qualified.length === 0) {
    return { rewarded: false, reason: "no qualified referrals" };
  }

  const firstQualified = qualified[0];
  const creditAmount = 50;

  await db.collection("wallet").updateOne(
    { ownerId: referral.referrerId },
    {
      $inc: { balance: creditAmount },
      $set: {
        lastCredit: "referral",
        lastCreditAmount: creditAmount,
        lastCreditAt: new Date(),
      },
    },
    { upsert: true },
  );

  await db.collection(COLLECTIONS.referrals).updateOne(
    { _id: new ObjectId(referralId) },
    {
      $set: {
        "redemptions.$[elem].rewardedAt": new Date(),
      },
    },
    {
      arrayFilters: [
        { "elem.referredId": firstQualified.referredId },
        { "elem.qualifiedAt": { $ne: null } },
        { "elem.rewardedAt": null },
      ],
    },
  );

  context.log(
    `Referral reward granted: +${creditAmount} credits to ${referral.referrerId}`,
  );

  return { rewarded: true, reason: "qualified referral rewarded" };
}
