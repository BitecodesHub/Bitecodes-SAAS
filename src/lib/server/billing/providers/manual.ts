import "server-only";

import type {
  BillingProvider,
  CheckoutResult,
} from "@/lib/server/billing/provider";
import type { BillingOrderDoc } from "@/lib/server/db/types";
import { formatPackPrice, getPack } from "@/lib/server/billing/packs";
import { siteConfig } from "@/lib/site";

/**
 * The always-available fallback provider.
 *
 * With no gateway configured, an order still gets created and the customer is
 * told exactly what to pay and how to reach us; an owner then grants the credits
 * from the admin panel once the money lands. That keeps the product sellable
 * before Razorpay credentials exist, and gives the tests a provider that needs
 * no network.
 *
 * It deliberately cannot verify webhooks: there is no gateway to send them, and
 * accepting an unauthenticated "payment received" callback would be a way to
 * mint free credits.
 */
export const manualProvider: BillingProvider = {
  id: "manual",

  isConfigured() {
    return true;
  },

  async createCheckout(order: BillingOrderDoc): Promise<CheckoutResult> {
    const pack = getPack(order.packId);
    const price = pack ? formatPackPrice(pack) : `${order.amount / 100}`;
    return {
      kind: "manual",
      instructions: [
        `Order ${order.orderId} is reserved for ${order.credits.toLocaleString()} submission credits (${price}).`,
        `Online card and UPI checkout is not switched on yet. Email ${siteConfig.contact.salesEmail} or message ${siteConfig.contact.phone} on WhatsApp quoting this order number, and we will send payment details and add the credits as soon as it clears.`,
      ].join(" "),
    };
  },

  verifyWebhook() {
    return null;
  },
};
