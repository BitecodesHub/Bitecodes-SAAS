import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";
import { randomUUID } from "node:crypto";

export const metadata: Metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

export default async function AppReferralsPage() {
  await requireCapability("manage_chatbots");

  const db = await getDatabase();
  const referrals = await db
    .collection(COLLECTIONS.referrals)
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  const myReferralCode = `BC-${randomUUID().toString().slice(-6).toUpperCase()}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Share your code and earn credits when friends sign up.
        </p>
      </header>

      <div className="bg-card/50 rounded-lg border p-6">
        <div className="mb-4 flex items-center gap-4">
          <span className="text-xl font-medium">Your Referral Code</span>
          <input
            value={myReferralCode}
            readOnly
            className="border-border focus-outline flex-1 rounded border px-4 py-2"
          />
          <button
            onClick={() => navigator.clipboard.writeText(myReferralCode)}
            className="border-border hover:bg-primary rounded border px-4 py-2"
          >
            Copy
          </button>
        </div>

        <p className="text-muted-foreground mb-4 text-xs">
          Share your code and earn credits when friends sign up.
        </p>

        <div className="space-y-4">
          {referrals.map((ref) => (
            <div key={ref._id.toString()} className="rounded border p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm">{ref.code}</span>
                <span className="text-muted-foreground text-xs">
                  {ref.redemptions.length} redemption
                  {ref.redemptions.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
