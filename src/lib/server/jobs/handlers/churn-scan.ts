import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";
export async function handleChurnScan(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const db = await getDatabase();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const customers = await db
    .collection("customers")
    .aggregate([
      {
        $lookup: {
          from: "lifecycle_events",
          localField: "_id",
          foreignField: "ownerId",
          as: "events",
        },
      },
      {
        $lookup: {
          from: "support_tickets",
          localField: "_id",
          foreignField: "ownerId",
          as: "tickets",
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          lastActivityAt: { $max: "$events.createdAt" },
          sessionCount30d: {
            $size: {
              $filter: {
                input: "$events",
                as: "e",
                cond: { $gte: ["$e.createdAt", thirtyDaysAgo] },
              },
            },
          },
          subscriptionAgeMonths: {
            $divide: [
              { $toLong: now },
              {
                $toLong: {
                  $dateDiff: {
                    startDate: "$createdAt",
                    endDate: now,
                    unit: "day",
                  },
                },
              },
            ],
          },
          supportTickets30d: {
            $size: {
              $filter: {
                input: "$tickets",
                as: "t",
                cond: { $gte: ["$t.createdAt", thirtyDaysAgo] },
              },
            },
          },
        },
      },
      { $match: { lastActivityAt: { $ne: null } } },
    ])
    .toArray();

  const riskUpdates = customers.map((cust) => {
    const daysSinceLastActivity =
      now.getTime() - (cust.lastActivityAt as Date).getTime();
    const recentSessions = cust.sessionCount30d as number;
    const subAgeMonths = cust.subscriptionAgeMonths as number;
    const tickets30d = cust.supportTickets30d as number;

    let score = 0;
    const signals: string[] = [];

    if (daysSinceLastActivity > 90 * 24 * 60 * 60 * 1000) {
      score += 30;
      signals.push("inactive_90d");
    } else if (daysSinceLastActivity > 30 * 24 * 60 * 60 * 1000) {
      score += 15;
      signals.push("inactive_30d");
    }

    if (recentSessions < 3) {
      score += 20;
      signals.push("low_session_count");
    }

    if (subAgeMonths > 12 && recentSessions < 10) {
      score += 15;
      signals.push("low_engagement_old_sub");
    }

    if (tickets30d >= 5) {
      score += 25;
      signals.push("high_support_tickets");
    }

    const level: "low" | "medium" | "high" =
      score < 30 ? "low" : score < 70 ? "medium" : "high";

    const update: Record<string, unknown> = {
      score,
      level,
      signals,
      scoredAt: new Date(),
    };

    if (level === "high" && !cust.winbackSentAt) {
      update.winbackSentAt = new Date();
    }

    return {
      filter: { _id: cust._id },
      update,
    };
  });

  for (const { filter, update } of riskUpdates) {
    await db
      .collection(COLLECTIONS.churnRisk)
      .replaceOne(
        { ownerId: (filter._id as string) || "" },
        { ownerId: filter._id as string, ...update },
        { upsert: true },
      );
  }

  const highRiskCount = riskUpdates.filter(
    (r) => (r.update as Record<string, unknown>)["level"] === "high",
  ).length;

  context.log(
    `Churn scan complete: ${customers.length} customers scored, ${highRiskCount} high risk`,
  );

  return { scored: customers.length, highRisk: highRiskCount };
}
