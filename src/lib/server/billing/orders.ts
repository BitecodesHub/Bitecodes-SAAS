import "server-only";

import { randomUUID } from "node:crypto";
import { billingOrders } from "@/lib/server/db/collections";
import type { BillingOrderDoc } from "@/lib/server/db/types";
import { getPack } from "@/lib/server/billing/packs";
import { manualProvider } from "@/lib/server/billing/providers/manual";
import { razorpayProvider } from "@/lib/server/billing/providers/razorpay";
import type { BillingProvider } from "@/lib/server/billing/provider";

/**
 * Orders and provider selection.
 *
 * An order is created *before* the customer is sent to pay, so an inbound
 * webhook always has a record to match against. Orders are never trusted from
 * the client: the credits and amount come from the server-side pack definition,
 * so a tampered checkout request cannot buy 12,500 credits for the price of 500.
 */

/** Razorpay when it has credentials, otherwise the manual fallback. */
export function getActiveProvider(): BillingProvider {
  return razorpayProvider.isConfigured() ? razorpayProvider : manualProvider;
}

/** Every provider that could receive a webhook, for verification attempts. */
export function allProviders(): BillingProvider[] {
  return [razorpayProvider, manualProvider];
}

export async function createOrder(input: {
  ownerId: string;
  packId: string;
}): Promise<BillingOrderDoc | null> {
  const pack = getPack(input.packId);
  if (!pack) return null;

  const provider = getActiveProvider();
  const now = new Date();
  const doc: Omit<BillingOrderDoc, "_id"> = {
    orderId: `ord_${randomUUID()}`,
    ownerId: input.ownerId,
    product: pack.product,
    packId: pack.packId,
    // Server-side pack values — never client input.
    credits: pack.credits,
    amount: pack.amount,
    currency: pack.currency,
    gateway: provider.id,
    gatewayOrderId: null,
    status: "pending",
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const collection = await billingOrders();
  await collection.insertOne(doc as BillingOrderDoc);
  return doc as BillingOrderDoc;
}

export async function getOrder(
  orderId: string,
): Promise<BillingOrderDoc | null> {
  const collection = await billingOrders();
  return collection.findOne({ orderId });
}

export async function listOrders(
  ownerId: string,
  limit = 20,
): Promise<BillingOrderDoc[]> {
  const collection = await billingOrders();
  return collection
    .find({ ownerId })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .toArray();
}

/**
 * Marks an order paid. Conditional on it still being `pending`, so a repeated
 * webhook cannot flip an already-settled order and the caller can tell whether
 * this delivery was the one that settled it.
 */
export async function markOrderPaid(
  orderId: string,
  now = new Date(),
): Promise<boolean> {
  const collection = await billingOrders();
  const result = await collection.updateOne(
    { orderId, status: "pending" },
    { $set: { status: "paid", paidAt: now, updatedAt: now } },
  );
  return result.modifiedCount === 1;
}

/**
 * Records a failed payment attempt. Conditional on `pending`, so a late
 * failure cannot flip an order that a manual grant or an earlier webhook
 * already settled.
 */
export async function markOrderFailed(
  orderId: string,
  now = new Date(),
): Promise<boolean> {
  const collection = await billingOrders();
  const result = await collection.updateOne(
    { orderId, status: "pending" },
    { $set: { status: "failed", updatedAt: now } },
  );
  return result.modifiedCount === 1;
}

/**
 * Atomically claims the right to finish a settlement whose original delivery
 * died between marking the order paid and crediting the wallet. Exactly one
 * caller ever wins: the field is null until claimed and never re-claimed.
 */
export async function claimOrderSettlementResume(
  orderId: string,
  now = new Date(),
): Promise<boolean> {
  const collection = await billingOrders();
  const result = await collection.updateOne(
    { orderId, status: "paid", settlementResumedAt: null },
    { $set: { settlementResumedAt: now, updatedAt: now } },
  );
  return result.modifiedCount === 1;
}

export async function setGatewayOrderId(
  orderId: string,
  gatewayOrderId: string,
): Promise<void> {
  const collection = await billingOrders();
  await collection.updateOne(
    { orderId },
    { $set: { gatewayOrderId, updatedAt: new Date() } },
  );
}
