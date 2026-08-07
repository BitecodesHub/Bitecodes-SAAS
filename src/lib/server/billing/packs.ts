import "server-only";

import type { WalletProduct } from "@/lib/server/db/types";

/**
 * Prepaid credit packs.
 *
 * ⚠️ LAUNCH PLACEHOLDER PRICING — the owner sets the real numbers.
 * Every price lives in this one file, so changing them is a single edit with no
 * other code to touch. They are marked as a launch offer on the pricing section
 * so the figures are never presented as final.
 *
 * Amounts are held in **minor units** (paise for INR) because floating-point
 * money accumulates error; the display layer divides by 100 once.
 */

export const PACKS_ARE_PLACEHOLDER_PRICING = true;

export interface CreditPack {
  packId: string;
  product: WalletProduct;
  label: string;
  credits: number;
  /** Minor units of `currency`. */
  amount: number;
  currency: "INR";
  /** Shown on the pricing card. */
  blurb: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    packId: "forms-starter",
    product: "forms",
    label: "Starter",
    credits: 500,
    amount: 49_900, // ₹499
    currency: "INR",
    blurb: "For a single site with steady enquiries.",
  },
  {
    packId: "forms-growth",
    product: "forms",
    label: "Growth",
    credits: 2_500,
    amount: 149_900, // ₹1,499
    currency: "INR",
    blurb: "For a busy site or a handful of forms.",
    popular: true,
  },
  {
    packId: "forms-scale",
    product: "forms",
    label: "Scale",
    credits: 12_500,
    amount: 499_900, // ₹4,999
    currency: "INR",
    blurb: "For agencies running forms across many client sites.",
  },
];

export function getPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.packId === packId);
}

export function packsFor(product: WalletProduct): CreditPack[] {
  return CREDIT_PACKS.filter((p) => p.product === product);
}

/** Major-unit display string, e.g. `₹1,499`. */
export function formatPackPrice(pack: CreditPack): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: pack.currency,
    maximumFractionDigits: 0,
  }).format(pack.amount / 100);
}

/** Per-submission cost, for the "works out at" line on the pricing card. */
export function perSubmissionPrice(pack: CreditPack): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: pack.currency,
    maximumFractionDigits: 2,
  }).format(pack.amount / 100 / pack.credits);
}
