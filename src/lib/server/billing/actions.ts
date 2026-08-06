"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import {
  createOrder,
  getActiveProvider,
  setGatewayOrderId,
} from "@/lib/server/billing/orders";
import { getPack } from "@/lib/server/billing/packs";
import { credit } from "@/lib/server/wallet/wallet";
import type { WalletProduct } from "@/lib/server/db/types";

/**
 * Billing actions.
 *
 * `createCheckoutAction` needs only `manage_forms` — buying credits for your own
 * account is ordinary use. `grantCreditsAction` requires `manage_settings`
 * (owner/admin), because handing out credits without a payment is a money
 * decision, not a day-to-day one.
 */

export type BillingActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export type CheckoutStarted =
  | { kind: "redirect"; url: string; orderId: string }
  | { kind: "manual"; instructions: string; orderId: string };

/**
 * Starts a purchase. Creates the order server-side from the pack definition, so
 * the price and credit count can never be set by the client.
 */
export async function createCheckoutAction(
  packId: string,
): Promise<BillingActionResult<CheckoutStarted>> {
  const session = await assertCapability("manage_forms");

  const pack = getPack(packId);
  if (!pack) return fail("That pack is not available.");

  const order = await createOrder({ ownerId: session.userId, packId });
  if (!order) return fail("That pack is not available.");

  await recordAudit({
    action: AUDIT_ACTIONS.billingOrderCreated,
    actorId: session.userId,
    target: { type: "billing_order", id: order.orderId },
    detail: { packId, credits: order.credits, gateway: order.gateway },
  });

  const provider = getActiveProvider();
  try {
    const checkout = await provider.createCheckout(order);
    if (checkout.kind === "redirect") {
      // Record the gateway's own id so the webhook can be reconciled by hand.
      const gatewayId = new URL(checkout.url).searchParams.get("checkout");
      if (gatewayId) await setGatewayOrderId(order.orderId, gatewayId);
      return {
        ok: true,
        data: { kind: "redirect", url: checkout.url, orderId: order.orderId },
      };
    }
    return {
      ok: true,
      data: {
        kind: "manual",
        instructions: checkout.instructions,
        orderId: order.orderId,
      },
    };
  } catch {
    return fail(
      "Checkout could not be started. Please try again, or contact us to pay directly.",
    );
  }
}

const grantSchema = z.object({
  ownerId: z.string().trim().min(1).max(64),
  product: z.enum(["chatbot", "forms"]),
  amount: z.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

/**
 * Grants credits without a payment — for settling a manual bank transfer, or
 * making good on an incident. Always audited, because it creates value.
 */
export async function grantCreditsAction(input: {
  ownerId: string;
  product: WalletProduct;
  amount: number;
  note?: string;
}): Promise<BillingActionResult<{ balance: number }>> {
  const session = await assertCapability("manage_settings");

  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Give an account, a product, and a whole number of credits.");
  }

  const balance = await credit({
    ownerId: parsed.data.ownerId,
    product: parsed.data.product,
    amount: parsed.data.amount,
    kind: "bonus",
    note: parsed.data.note?.trim() || "manual grant",
  });

  await recordAudit({
    action: AUDIT_ACTIONS.billingCreditsGranted,
    actorId: session.userId,
    target: { type: "wallet", id: parsed.data.ownerId },
    detail: {
      product: parsed.data.product,
      amount: parsed.data.amount,
      note: parsed.data.note ?? null,
    },
  });

  revalidatePath("/admin/forms");
  return { ok: true, data: { balance } };
}

/** Grants credits to the acting admin's own account — the common case. */
export async function grantSelfCreditsAction(
  product: WalletProduct,
  amount: number,
  note?: string,
): Promise<BillingActionResult<{ balance: number }>> {
  const session = await assertCapability("manage_settings");
  return grantCreditsAction({
    ownerId: session.userId,
    product,
    amount,
    note,
  });
}
