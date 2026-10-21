import crypto from "crypto";
import { getRandomValues } from "node:crypto";
import type { JobContext } from "@/lib/server/jobs/worker";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";
import type { FeedbackDoc } from "@/lib/server/db/types";
import { getGrowthToggle } from "@/lib/growth/toggles";

export async function handleFeedbackRequests(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  if (!getGrowthToggle("feedbackRequests")) {
    return { skipped: "disabled" };
  }

  const db = await getDatabase();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentWeek = now.toISOString().slice(0, 7);

  const eligible = await db
    .collection(COLLECTIONS.feedback)
    .find({
      $or: [
        { status: "requested", requestedAt: { $lt: weekAgo } },
        { status: "received", respondedAt: { $lt: weekAgo } },
      ],
    })
    .limit(50)
    .toArray();

  const results = await Promise.all(
    eligible.map(async (fb) => {
      const shouldSurvey =
        fb.surveyKey !== currentWeek &&
        (fb.source !== "nps-survey" || fb.score === null);

      if (!shouldSurvey) return null;

      const randomBytes = new Uint8Array(10);
      getRandomValues(randomBytes);
      const token = Array.from(randomBytes)
        .map((b) => b.toString(36))
        .join("")
        .slice(0, 10);

      const tokenBuf = Buffer.from(token, "utf8");
      const hash = crypto.createHash("sha256").update(tokenBuf).digest();
      const tokenHashHex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await db.collection(COLLECTIONS.feedback).updateOne(
        { _id: fb._id },
        {
          $set: {
            tokenHash: tokenHashHex,
            surveyKey: currentWeek,
            status: "requested",
            requestedAt: new Date(),
          },
        },
      );

      return {
        email: fb.email,
        score: fb.score,
        tokenHash: tokenHashHex,
      };
    }),
  );

  const sent = results.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  ).length;
  context.log(`Feedback requests: ${sent} surveys sent`);

  return { sent, eligible: eligible.length };
}
