import "server-only";

import { billingEvents } from "@/lib/server/db/collections";
import {
  allProviders,
  getOrder,
  markOrderPaid,
} from "@/lib/server/billing/orders";
import { credit } from "@/lib/server/wallet/wallet";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import type { BillingGateway } from "@/lib/server/db/types";

/**
 * Webhook processing: verify, then credit exactly once.
 *
 * Payment providers retry deliveries, and a retry must never grant a second
 * pack. Idempotency is enforced by the database rather than by a check-then-act
 * read: the unique index on `{gateway, eventId}` means the *insert* is the lock,
 * so two concurrent deliveries of the same event cannot both proceed. A
 * duplicate-key error is success — the work is already done.
 *
 * Ordering matters. The event is recorded first, then the wallet is credited. If
 * a crash happened between them a customer could be short-credited, which is
 * recoverable by hand; the reverse order risks double-crediting on every retry,
 * which is not.
 */

export type WebhookOutcome =
  | { kind: "credited"; orderId: string; credits: number }
  | { kind: "duplicate" }
  | { kind: "ignored"; reason: string }
  | { kind: "unverified" };

/** True when the error is Mongo's duplicate-key violation. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export async function processWebhook(
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  // Try each configured provider; an unverifiable body is rejected outright.
  for (const provider of allProviders()) {
    if (!provider.isConfigured()) continue;
    const event = provider.verifyWebhook(rawBody, headers);
    if (!event) continue;

    if (!event.paid) {
      return { kind: "ignored", reason: "not a payment-captured event" };
    }
    if (!event.orderId) {
      return { kind: "ignored", reason: "no order reference on the event" };
    }

    return settle(provider.id, event.eventId, event.orderId);
  }

  return { kind: "unverified" };
}

async function settle(
  gateway: BillingGateway,
  eventId: string,
  orderId: string,
): Promise<WebhookOutcome> {
  const events = await billingEvents();

  // The insert IS the idempotency lock.
  try {
    await events.insertOne({
      gateway,
      eventId,
      orderId,
      processedAt: new Date(),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { kind: "duplicate" };
    throw error;
  }

  const order = await getOrder(orderId);
  if (!order) return { kind: "ignored", reason: "unknown order" };

  // Conditional on `pending`, so a manual grant that already settled this order
  // cannot be topped up a second time by a late webhook.
  const settled = await markOrderPaid(orderId);
  if (!settled) return { kind: "duplicate" };

  await credit({
    ownerId: order.ownerId,
    product: order.product,
    amount: order.credits,
    kind: "purchase",
    note: `order:${order.orderId}`,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.billingWebhookProcessed,
    actorId: null,
    target: { type: "billing_order", id: orderId },
    detail: { gateway, credits: order.credits, product: order.product },
  });

  return { kind: "credited", orderId, credits: order.credits };
}
