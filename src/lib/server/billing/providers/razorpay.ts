import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  BillingProvider,
  CheckoutResult,
  VerifiedGatewayEvent,
} from "@/lib/server/billing/provider";
import type { BillingOrderDoc } from "@/lib/server/db/types";
import { getRazorpayConfig, getSiteUrl } from "@/lib/server/env";

/**
 * Razorpay provider.
 *
 * Chosen first because the business is India-registered: INR and GST are native,
 * and UPI is the payment method most Indian customers expect. Stripe can be
 * added later as a second implementation of the same interface.
 *
 * Signature verification is implemented here and now — it is the part that must
 * be right, and it needs no live account to be correct. `createCheckout` calls
 * the Orders API when keys are present; with no keys the provider reports itself
 * unconfigured and `getActiveProvider()` never selects it.
 */

const ORDERS_ENDPOINT = "https://api.razorpay.com/v1/orders";

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // `timingSafeEqual` throws on a length mismatch, which would itself leak; the
  // length check is not secret, the contents are.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const razorpayProvider: BillingProvider = {
  id: "razorpay",

  isConfigured() {
    return getRazorpayConfig() !== null;
  },

  async createCheckout(order: BillingOrderDoc): Promise<CheckoutResult> {
    const config = getRazorpayConfig();
    if (!config) throw new Error("RAZORPAY_NOT_CONFIGURED");

    const auth = Buffer.from(
      `${config.keyId}:${config.keySecret}`,
      "utf8",
    ).toString("base64");

    const response = await fetch(ORDERS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: order.amount,
        currency: order.currency,
        // Our id travels with the payment so the webhook can find the order.
        receipt: order.orderId,
        notes: { orderId: order.orderId, packId: order.packId },
      }),
      cache: "no-store",
    });

    if (!response.ok) throw new Error("RAZORPAY_ORDER_FAILED");
    const payload = (await response.json()) as { id?: string };
    if (!payload.id) throw new Error("RAZORPAY_ORDER_FAILED");

    // Razorpay's hosted page is opened by their checkout script with this id;
    // our return page carries it plus the key so the browser can launch it.
    return {
      kind: "redirect",
      url: `${getSiteUrl()}/admin/forms?checkout=${encodeURIComponent(payload.id)}&order=${encodeURIComponent(order.orderId)}`,
    };
  },

  verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): VerifiedGatewayEvent | null {
    const config = getRazorpayConfig();
    if (!config) return null;

    const signature = headers.get("x-razorpay-signature");
    if (!signature) return null;

    const expected = createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (!constantTimeEquals(signature, expected)) return null;

    // Only parse once the signature proves the body is ours.
    let event: {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; notes?: { orderId?: string } } };
        order?: { entity?: { receipt?: string } };
      };
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const paymentEntity = event.payload?.payment?.entity;
    // Razorpay does not send a dedicated event id header, so the payment id is
    // the stable per-delivery key; retries of the same payment repeat it, which
    // is exactly what the idempotency guard needs.
    const eventId = paymentEntity?.id ?? null;
    if (!eventId) return null;

    const orderId =
      paymentEntity?.notes?.orderId ??
      event.payload?.order?.entity?.receipt ??
      null;

    return {
      eventId,
      orderId,
      paid: event.event === "payment.captured" || event.event === "order.paid",
    };
  },
};
