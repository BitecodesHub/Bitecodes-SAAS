import "server-only";

import { getSettingsFresh } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";
import type { LifecycleEventDoc } from "@/lib/server/db/types";

/**
 * `lifecycle.tick` — Customer onboarding nudges, renewal reminders, and cross-sell suggestions.
 *
 * Returns { skipped: "disabled" } when settings.growth.lifecycleEmails is off,
 * stays idempotent (dedup via lifecycleEvents), respects context.deadline, and
 * returns a small JSON summary.
 */
export async function handleLifecycleTick(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();

  if (!settings.growth.lifecycleEmails) {
    context.log("Customer lifecycle emails are disabled in growth settings.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const deadline = context.deadline;

  let onboardingNudges = 0;
  let renewalReminders = 0;
  let upsellCrossSell = 0;
  const eventKeys: string[] = [];

  const database = await (await import("@/lib/server/mongodb")).getDatabase();
  const lifecycleEventsCollection =
    database.collection<LifecycleEventDoc>("lifecycle_events");

  // Process onboarding nudges for customers who signed up recently but haven't been touched
  const onboardingWindowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const onboardingWindowEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const customersNeedingOnboarding = await database
    .collection("admin_users")
    .find({
      role: "customer",
      createdAt: { $gte: onboardingWindowStart, $lt: onboardingWindowEnd },
      "profile.onboardingCompleted": false,
    })
    .toArray();

  for (const customer of customersNeedingOnboarding) {
    const idempotencyKey = `onboarding.day-3.${customer._id.toString()}.${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const exists = await lifecycleEventsCollection.countDocuments({
      key: idempotencyKey,
    });

    if (exists > 0) continue;

    if (deadline && Date.now() > deadline - 5_000) {
      context.log("Lifecycle tick past deadline, stopping.");
      break;
    }

    // Record the lifecycle event for idempotency
    await lifecycleEventsCollection.insertOne({
      ownerId: customer._id.toString(),
      key: idempotencyKey,
      kind: "onboarding" as const,
      channel: "email",
      detail: { day: 3, message: "Welcome nudge" } as Record<string, unknown>,
      emailMessageId: null,
      createdAt: new Date(),
    } as LifecycleEventDoc);

    onboardingNudges += 1;
    eventKeys.push(idempotencyKey);
  }

  // Process renewal reminders for customers whose subscription is ending soon
  const renewalCutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 14),
  );

  const customersNeedingRenewal = await database
    .collection("admin_users")
    .find({
      role: "customer",
      subscription: { $exists: true },
      "subscription.endsAt": {
        $gte: onboardingWindowStart,
        $lt: renewalCutoff,
      },
    })
    .toArray();

  for (const customer of customersNeedingRenewal) {
    const idempotencyKey = `renewal.chatbot.${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const exists = await lifecycleEventsCollection.countDocuments({
      key: idempotencyKey,
    });

    if (exists > 0) continue;

    if (deadline && Date.now() > deadline - 5_000) {
      context.log("Lifecycle tick past deadline, stopping.");
      break;
    }

    await lifecycleEventsCollection.insertOne({
      ownerId: customer._id.toString(),
      key: idempotencyKey,
      kind: "renewal" as const,
      channel: "email",
      detail: { message: "Renewal reminder", daysUntil: 14 } as Record<
        string,
        unknown
      >,
      emailMessageId: null,
      createdAt: new Date(),
    } as LifecycleEventDoc);

    renewalReminders += 1;
    eventKeys.push(idempotencyKey);
  }

  // Process upsell/cross-sell suggestions for active customers
  const activeCustomers = await database
    .collection("admin_users")
    .find({
      role: "customer",
      subscription: { $exists: true },
      status: "active",
    })
    .limit(20)
    .toArray();

  for (const customer of activeCustomers) {
    const idempotencyKey = `upsell.chatbot.${customer._id.toString()}.${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const exists = await lifecycleEventsCollection.countDocuments({
      key: idempotencyKey,
    });

    if (exists > 0) continue;

    if (deadline && Date.now() > deadline - 5_000) {
      context.log("Lifecycle tick past deadline, stopping.");
      break;
    }

    await lifecycleEventsCollection.insertOne({
      ownerId: customer._id.toString(),
      key: idempotencyKey,
      kind: "upsell" as const,
      channel: "email",
      detail: { suggestion: "chatbot upgrade", plan: "pro" } as Record<
        string,
        unknown
      >,
      emailMessageId: null,
      createdAt: new Date(),
    } as LifecycleEventDoc);

    upsellCrossSell += 1;
    eventKeys.push(idempotencyKey);
  }

  return {
    onboardingNudges,
    renewalReminders,
    upsellCrossSell,
    eventKeysCount: eventKeys.length,
  };
}
