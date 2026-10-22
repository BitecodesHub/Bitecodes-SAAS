import "server-only";

import type { DigestRange, DigestSection } from "@/lib/server/digest/types";
import type { DigestMetric } from "@/lib/server/digest/types";

/**
 * Digest section "customers-lifecycle": Customer onboarding progress, renewals due, and lifecycle emails sent.
 *
 * Returns null when there is nothing to report.
 */
export async function buildSection(
  _range: DigestRange,
): Promise<DigestSection | null> {
  void _range;
  const { getDatabase } = await import("@/lib/server/mongodb");
  const database = await getDatabase();
  const now = new Date();

  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const lifecycleEventsCollection = database.collection<{
    kind: string;
    detail?: Record<string, unknown>;
  }>("lifecycle_events");

  const onboardingCount = await lifecycleEventsCollection.countDocuments({
    kind: "onboarding",
    createdAt: { $gte: dayStart },
  });

  const renewalCount = await lifecycleEventsCollection.countDocuments({
    kind: "renewal",
    createdAt: { $gte: dayStart },
  });

  const upsellCount = await lifecycleEventsCollection.countDocuments({
    kind: "upsell",
    createdAt: { $gte: dayStart },
  });

  if (onboardingCount === 0 && renewalCount === 0 && upsellCount === 0) {
    return null;
  }

  const metrics: DigestMetric[] = [
    { label: "Onboarding nudges", value: onboardingCount },
    { label: "Renewal reminders", value: renewalCount },
    { label: "Upsell/cross-sell", value: upsellCount },
  ];

  const blocks: import("@/lib/email/template").EmailBlock[] = [
    {
      type: "p",
      text: `${onboardingCount} onboarding nudges sent this period`,
    },
    {
      type: "p",
      text: `${renewalCount} renewal reminders sent this period`,
    },
    {
      type: "p",
      text: `${upsellCount} product suggestions sent this period`,
    },
  ];

  return {
    id: "customers-lifecycle",
    title: "Customer Lifecycle",
    summary: `Onboarding: ${onboardingCount}, Renewals: ${renewalCount}, Upsell/Cross-sell: ${upsellCount} this period`,
    metrics,
    blocks,
  };
}
