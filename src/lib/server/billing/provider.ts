import "server-only";

import type { BillingGateway, BillingOrderDoc } from "@/lib/server/db/types";

/**
 * The payment-gateway seam.
 *
 * Everything above this interface — packs, orders, the wallet credit, the
 * webhook idempotency guard — is gateway-agnostic and works today. Only the
 * two operations that genuinely need a payment processor sit behind it, so the
 * product can be sold before credentials exist (the manual provider takes over)
 * and switched on later by setting environment variables alone.
 */

export interface VerifiedGatewayEvent {
  /** Stable id from the gateway. The idempotency key for this delivery. */
  eventId: string;
  /** Our order id, recovered from the gateway payload. */
  orderId: string | null;
  /**
   * captured = the money arrived; failed = the payment attempt failed; other =
   * informational (refund, dispute, anything we do not act on).
   */
  outcome: "captured" | "failed" | "other";
  /**
   * Amount in integer minor units and its currency, when the payload states
   * them. A valid signature proves origin, not that we agreed on the price —
   * settlement compares these against the order.
   */
  amount?: number | null;
  currency?: string | null;
}

export type CheckoutResult =
  | { kind: "redirect"; url: string }
  /** No gateway configured: tell the customer how to pay us directly. */
  | { kind: "manual"; instructions: string };

export interface BillingProvider {
  readonly id: BillingGateway;
  /** True when this provider has everything it needs to take a payment. */
  isConfigured(): boolean;
  createCheckout(order: BillingOrderDoc): Promise<CheckoutResult>;
  /**
   * Verifies a webhook's authenticity from the RAW body and headers. Returns
   * null when the signature does not match — an unverified event must never
   * credit an account.
   */
  verifyWebhook(rawBody: string, headers: Headers): VerifiedGatewayEvent | null;
}
