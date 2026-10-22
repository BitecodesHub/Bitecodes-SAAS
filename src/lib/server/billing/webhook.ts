import "server-only";

import { billingEvents } from "@/lib/server/db/collections";
import {
  allProviders,
  claimOrderSettlementResume,
  getOrder,
  markOrderFailed,
  markOrderPaid,
} from "@/lib/server/billing/orders";
import { credit, hasCreditRef } from "@/lib/server/wallet/wallet";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import type { VerifiedGatewayEvent } from "@/lib/server/billing/provider";
import type { BillingGateway } from "@/lib/server/db/types";

/**
 * Webhook processing: verify, then credit exactly once.
 *
 * Payment providers retry deliveries, and a retry must never grant a second
 * pack. Idempotency is enforced by the database rather than by a check-then-act
 * read: the unique index on `{gateway, eventId}` means the *insert* is the lock,
 * so two concurrent deliveries of the same event cannot both proceed. A
 * duplicate-key error means another delivery owns the settlement.
 *
 * Ordering matters, twice over:
 *
 *  1. The order is looked up BEFORE the event is recorded. Recording first
 *     burned the event's idempotency slot on every unknown order, so a payment
 *     whose order row had not landed yet could never be credited — every retry
 *     returned "duplicate" for work that was never done.
 *  2. Within a settlement, the order is marked paid BEFORE the wallet is
 *     credited. A crash between them leaves the customer short-credited, which
 *     is recoverable: the retry sees a paid order with no ledger row and
 *     finishes the credit. The reverse order risks double-crediting on every
 *     retry, which is not recoverable.
 *
 * Crash recovery uses a lease: a delivery that finds the order already paid,
 * the credit missing, and the claim older than `SETTLEMENT_LEASE_MS` concludes
 * the original claimant died mid-settlement and completes it — but only after
 * atomically claiming the resume, so two late retries cannot both finish the
 * job. A fresh claim is assumed to belong to a delivery still in flight and is
 * left alone.
 */

/** Long enough that no live settlement is mistaken for a dead one. */
const SETTLEMENT_LEASE_MS = 60_000;

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

    if (!event.orderId) {
      return { kind: "ignored", reason: "no order reference on the event" };
    }

    if (event.outcome === "failed")
      return recordFailedPayment(provider.id, event);
    if (event.outcome !== "captured") {
      return { kind: "ignored", reason: "not a payment-captured event" };
    }

    return settle(provider.id, event);
  }

  return { kind: "unverified" };
}

/** Marks a failed attempt on the order so it stops looking collectible. */
async function recordFailedPayment(
  gateway: BillingGateway,
  event: VerifiedGatewayEvent,
): Promise<WebhookOutcome> {
  const order = await getOrder(event.orderId!);
  if (!order) return { kind: "ignored", reason: "unknown order" };

  const failed = await markOrderFailed(order.orderId);
  if (failed) {
    await recordAudit({
      action: AUDIT_ACTIONS.billingWebhookProcessed,
      actorId: null,
      target: { type: "billing_order", id: order.orderId },
      detail: { gateway, failed: true },
    });
  }
  return { kind: "ignored", reason: "payment failed" };
}

async function settle(
  gateway: BillingGateway,
  event: VerifiedGatewayEvent,
): Promise<WebhookOutcome> {
  const order = await getOrder(event.orderId!);
  if (!order) return { kind: "ignored", reason: "unknown order" };

  // A valid signature proves the event came from the gateway; it does not
  // prove the amount is what we charged. Integer minor units on both sides.
  if (event.amount != null && event.amount !== order.amount) {
    return {
      kind: "ignored",
      reason: `amount mismatch: order ${order.amount}, payment ${event.amount}`,
    };
  }
  if (event.currency && event.currency !== order.currency) {
    return {
      kind: "ignored",
      reason: `currency mismatch: order ${order.currency}, payment ${event.currency}`,
    };
  }

  // The insert IS the idempotency lock against concurrent duplicates.
  const events = await billingEvents();
  try {
    await events.insertOne({
      gateway,
      eventId: event.eventId,
      orderId: order.orderId,
      processedAt: new Date(),
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  // Claim the settlement: exactly one delivery ever flips pending → paid, so
  // the credit below runs under exclusive ownership.
  const claimed = await markOrderPaid(order.orderId);
  if (claimed) {
    return completeSettlement(gateway, order, false);
  }

  // The order was already paid. Three possible worlds:
  //   a. an earlier delivery finished everything — the ledger row exists;
  //   b. a delivery is mid-settlement right now — the claim is fresh;
  //   c. a delivery died between claiming and crediting — stale claim, no row.
  if (await hasCreditRef(order.ownerId, order.product, order.orderId)) {
    return { kind: "duplicate" };
  }

  // Re-read after losing the claim: the local `order` predates it, so its
  // `paidAt` cannot tell world (b) from world (c).
  const fresh = await getOrder(order.orderId);
  if (!fresh) return { kind: "duplicate" };
  const paidRecently =
    fresh.paidAt !== null &&
    Date.now() - fresh.paidAt.getTime() < SETTLEMENT_LEASE_MS;
  if (paidRecently) {
    // World (b): let the live delivery finish; do not race it.
    return { kind: "duplicate" };
  }

  // World (c). The resume is itself claimed atomically, so concurrent late
  // retries cannot both complete a dead settlement.
  const resumed = await claimOrderSettlementResume(order.orderId);
  if (!resumed) return { kind: "duplicate" };

  return completeSettlement(gateway, fresh, true);
}

async function completeSettlement(
  gateway: BillingGateway,
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>,
  resumed: boolean,
): Promise<WebhookOutcome> {
  await credit({
    ownerId: order.ownerId,
    product: order.product,
    amount: order.credits,
    kind: "purchase",
    refId: order.orderId,
    note: `order:${order.orderId}`,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.billingWebhookProcessed,
    actorId: null,
    target: { type: "billing_order", id: order.orderId },
    detail: {
      gateway,
      credits: order.credits,
      product: order.product,
      resumed,
    },
  });

  return { kind: "credited", orderId: order.orderId, credits: order.credits };
}
