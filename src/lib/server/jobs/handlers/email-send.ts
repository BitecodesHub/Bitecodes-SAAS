import "server-only";

import { z } from "zod";
import { deliverMessage } from "@/lib/server/email/send";
import type { JobContext } from "@/lib/server/jobs/worker";

const payloadSchema = z.object({
  messageId: z.string().uuid(),
  track: z.boolean().optional(),
});

/**
 * Sends one queued message.
 *
 * The payload is validated rather than trusted: a job document is data that
 * outlives the code that wrote it, so a payload shape can change under a
 * deployment. An invalid payload throws, which dead-letters the job into the
 * admin panel instead of failing silently.
 */
export async function handleEmailSend(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Invalid email.send payload: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }

  const result = await deliverMessage(parsed.data.messageId, {
    track: parsed.data.track,
  });

  context.log(
    result.sent
      ? `Sent ${parsed.data.messageId}`
      : `Not sent (${result.reason ?? "unknown"})`,
  );

  return { ...result, messageId: parsed.data.messageId };
}
