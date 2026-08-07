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

  // Chatbot packs are denominated in **tokens**, not messages, because that is
  // what the provider bills and what the wallet debits — quoting messages would
  // be a promise the meter cannot keep, since a long answer costs more than a
  // short one.
  //
  // The message estimates below come from measured live traffic on this
  // deployment: a grounded answer cost 268, 489, and 759 tokens across three
  // real questions, so ~500 per message is a fair working average. That average
  // is what the blurbs describe, and it is deliberately described as roughly.
  {
    packId: "chatbot-starter",
    product: "chatbot",
    label: "Starter",
    credits: 250_000,
    amount: 49_900, // ₹499
    currency: "INR",
    blurb: "Roughly 500 answers. For one site with steady questions.",
  },
  {
    packId: "chatbot-growth",
    product: "chatbot",
    label: "Growth",
    credits: 1_250_000,
    amount: 149_900, // ₹1,499
    currency: "INR",
    blurb: "Roughly 2,500 answers. For a busy site.",
    popular: true,
  },
  {
    packId: "chatbot-scale",
    product: "chatbot",
    label: "Scale",
    credits: 6_250_000,
    amount: 499_900, // ₹4,999
    currency: "INR",
    blurb: "Roughly 12,500 answers. For agencies running several assistants.",
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

/**
 * The "works out at" line, in whatever unit the product is actually sold in.
 *
 * A per-credit figure is meaningless for the chatbot: a token pack divides down
 * to ₹0.002, which rounds to ₹0.00 on the card and tells a buyer nothing. Tokens
 * are therefore quoted per thousand, which lands in a range a person can reason
 * about, while submissions stay per one.
 */
export function perUnitPrice(pack: CreditPack): string {
  const unit = pack.product === "chatbot" ? 1_000 : 1;
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: pack.currency,
    maximumFractionDigits: 2,
  }).format((pack.amount / 100 / pack.credits) * unit);
  return pack.product === "chatbot" ? `${money} / 1k tokens` : money;
}
