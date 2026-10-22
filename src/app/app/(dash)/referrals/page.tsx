import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import {
  getOrCreateReferral,
  REFERRAL_REWARD_DESCRIPTION,
} from "@/lib/server/referrals";
import { ReferralCard } from "@/components/account/referral-card";

export const metadata: Metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

/**
 * The signed-in customer's own referral code and its redemptions.
 *
 * Scoped to the session user: the previous version listed every referral in the
 * database, which showed one customer another customer's code.
 */
export default async function AppReferralsPage() {
  const session = await requireCapability("manage_chatbots");
  const referral = await getOrCreateReferral(session.userId);

  const rewarded = referral.redemptions.filter(
    (redemption) => redemption.rewardedAt !== null,
  ).length;
  const pending = referral.redemptions.length - rewarded;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Share your link. When someone creates an account and confirms their
          email, you earn {REFERRAL_REWARD_DESCRIPTION}.
        </p>
      </header>

      <ReferralCard
        code={referral.code}
        redemptionCount={referral.redemptions.length}
        rewardLabel={REFERRAL_REWARD_DESCRIPTION}
      />

      <section className="bg-card/50 rounded-lg border p-6">
        <h2 className="font-semibold">Your referrals</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {rewarded} rewarded
          {pending > 0 ? `, ${pending} awaiting email confirmation` : ""}.
        </p>

        {referral.redemptions.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            No referrals yet. Share your link to get started.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {[...referral.redemptions].reverse().map((redemption) => (
              <li
                key={redemption.referredId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"
              >
                <span>
                  Signed up {redemption.signedUpAt.toISOString().slice(0, 10)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {redemption.rewardedAt
                    ? "Rewarded"
                    : redemption.qualifiedAt
                      ? "Verified — reward processing"
                      : "Awaiting email confirmation"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
