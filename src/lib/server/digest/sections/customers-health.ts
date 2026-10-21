import "server-only";

import type { DigestRange, DigestSection } from "@/lib/server/digest/types";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";

export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  const db = await getDatabase();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const churnRisk = await db
    .collection(COLLECTIONS.churnRisk)
    .find({
      scoredAt: { $gte: thirtyDaysAgo },
    })
    .sort({ scoredAt: -1 })
    .limit(5)
    .toArray();

  const feedbackCount = await db
    .collection(COLLECTIONS.feedback)
    .countDocuments({
      status: "received",
      respondedAt: { $gte: thirtyDaysAgo },
    });

  const testimonials = await db
    .collection(COLLECTIONS.testimonials)
    .find({ status: "approved" })
    .limit(3)
    .toArray();

  const highRiskCount = churnRisk.filter((r) => {
    let _a;
    return ((_a = r.level) === null || _a === void 0 ? false : _a) === "high";
  }).length;

  const totalScored = churnRisk.length;

  if (highRiskCount === 0 && feedbackCount === 0) {
    return null;
  }

  return {
    id: "customers-health",
    title: "Customer health",
    summary: `${totalScored} customers scored, ${highRiskCount} high risk`,
    metrics: [
      { label: "High risk", value: highRiskCount.toString() },
      { label: "Total scored", value: totalScored.toString() },
      { label: "Feedback received", value: feedbackCount.toString() },
    ],
    blocks: [],
    actions: [{ label: "View full health", href: "/admin/customer-health" }],
  };
}
