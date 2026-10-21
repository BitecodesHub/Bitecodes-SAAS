import { referrals } from "@/lib/server/db/collections";
import {
  createReferral,
  recordReferralRedemption,
  grantReferralRewardIfEligible,
} from "@/lib/server/referrals";
import type { ReferralDoc } from "@/lib/server/db/types";
import { z } from "zod";

const referralSchema = z.object({
  referralCode: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  name: z.string().trim().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = referralSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid referral code" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const referralCode = parsed.data.referralCode;
  const email = parsed.data.email;
  const name = parsed.data.name;

  const allReferrals = await referrals();
  const doc = await allReferrals.findOne({ code: referralCode });

  if (!doc || doc.status !== "active") {
    return new Response(
      JSON.stringify({ error: "Invalid or inactive referral code" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Check if this email already signed up with this referral
  const alreadyRedeemed = doc.redemptions.some((r) => r.referredId === email);

  if (alreadyRedeemed) {
    return new Response(
      JSON.stringify({ error: "Already signed up with this code" }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const now = new Date();

  await allReferrals.updateOne(
    { _id: doc._id },
    {
      $push: {
        redemptions: {
          referredId: email || "unknown",
          signedUpAt: now,
          qualifiedAt: null,
          rewardedAt: null,
        },
      },
    },
  );

  const result = await grantReferralRewardIfEligible(doc._id.toString(), {
    log: (msg) => console.log(`[referral] ${msg}`),
  });

  if (result.rewarded) {
    return new Response(
      JSON.stringify({
        success: true,
        rewarded: true,
        message: "Welcome! Your referrer earned 50 credits.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      rewarded: false,
      message: "Welcome! No referral reward eligible yet.",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
