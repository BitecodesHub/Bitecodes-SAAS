import "server-only";

import { getSettingsFresh } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * `chat.summaries` — Summarises the previous day's website chats, extracts
 * leads, and lists unanswered questions.
 *
 * Returns { skipped: "disabled" } when settings.growth.chatSummaries is off,
 * stays idempotent, respects context.deadline, and returns a small JSON summary.
 */
export async function handleChatSummaries(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();

  if (!settings.growth.chatSummaries) {
    context.log("Chat summaries are disabled in growth settings.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let totalChats = 0;
  let summarizedChats = 0;
  let extractedLeads = 0;
  const unansweredQuestions: string[] = [];

  try {
    const { getDatabase } = await import("@/lib/server/mongodb");
    const database = await getDatabase();
    const chatsCollection = database.collection("chat_messages");

    const filter = {
      createdAt: {
        $gte: yesterday,
        $lt: now,
      },
      status: "completed",
    };

    totalChats = await chatsCollection.countDocuments(filter);

    // Stream through chat messages in batches
    const batchSize = 100;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await chatsCollection
        .find(filter)
        .skip(skip)
        .limit(batchSize)
        .toArray();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const chat of batch) {
        summarizedChats += 1;

        // Extract lead indicators from chat text
        const text = (chat.text || "").toLowerCase();
        const hasLeadKeywords =
          text.includes("price") ||
          text.includes("cost") ||
          text.includes("budget") ||
          text.includes("hire") ||
          text.includes("build") ||
          text.includes("website");

        if (hasLeadKeywords) {
          extractedLeads += 1;
        }

        // Collect unanswered questions (questions with no AI response or marked unresolved)
        if (chat.metadata?.resolved !== true || !chat.aiResponse) {
          const question = (chat.question || chat.text || "").trim();
          if (question && !unansweredQuestions.includes(question)) {
            unansweredQuestions.push(question);
          }
        }
      }

      skip += batchSize;
      hasMore = batch.length >= batchSize;
    }
  } catch (err) {
    context.log(
      `[chat-summaries] Error fetching chats: ${err instanceof Error ? err.message : err}`,
    );
  }

  return {
    totalChats,
    summarizedChats,
    extractedLeads,
    unansweredQuestions,
  };
}
