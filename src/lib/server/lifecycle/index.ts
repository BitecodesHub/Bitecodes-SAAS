import "server-only";

import type { AdminUserDoc, WalletLedgerDoc } from "@/lib/server/db/types";
import type { CreditPack } from "@/lib/server/billing/packs";

/**
 * Pure lifecycle functions.
 *
 * Every function here is pure (no DB, no side effects) so they can be unit-tested
 * without a database. The job handlers and digest sections call these, then
 * persist results themselves.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingProgress {
  emailVerified: boolean;
  firstProductCreated: boolean;
  hasActivity: boolean;
  embedded: boolean;
  creditsPurchased: boolean;
  /** 0–100 representing how far through onboarding the customer is. */
  score: number;
}

export interface RunwayResult {
  /** Credits consumed per day on average over the last 30 days. */
  burnRate: number;
  /**
   * Days of runway remaining at the current burn rate.
   * Null when burnRate is 0 (no spend → cannot estimate).
   */
  daysRemaining: number | null;
  /** The current balance. */
  balance: number;
}

// OwnerDoc is the customer's AdminUserDoc with the wallet balance attached
// We keep it minimal: functions take only what they need.

export type OwnerDoc = Pick<
  AdminUserDoc,
  "emailVerifiedAt" | "createdAt" | "status" | "company"
> & {
  _id?: unknown;
  /** Number of products the owner has created (chatbots + forms + bookings). */
  productCount?: number;
  /** Whether any product has received at least one real event. */
  activityCount?: number;
  /** Whether any product has the embed snippet placed (proxy: productCount > 0). */
  embedCount?: number;
  /** Whether the owner has ever purchased credits. */
  hasPurchasedCredits?: boolean;
};

// ---------------------------------------------------------------------------
// 1. Onboarding progress
// ---------------------------------------------------------------------------

const STEP_WEIGHTS = {
  emailVerified: 25,
  firstProductCreated: 25,
  hasActivity: 20,
  embedded: 15,
  creditsPurchased: 15,
} as const;

/**
 * Derives onboarding completion from the owner document.
 *
 * Each field on OwnerDoc is populated by the caller from real DB queries, so
 * this function stays pure and easily testable.
 */
export function onboardingProgress(owner: OwnerDoc): OnboardingProgress {
  const emailVerified = Boolean(owner.emailVerifiedAt);
  const firstProductCreated = (owner.productCount ?? 0) > 0;
  const hasActivity = (owner.activityCount ?? 0) > 0;
  const embedded = (owner.embedCount ?? 0) > 0;
  const creditsPurchased = Boolean(owner.hasPurchasedCredits);

  const score =
    (emailVerified ? STEP_WEIGHTS.emailVerified : 0) +
    (firstProductCreated ? STEP_WEIGHTS.firstProductCreated : 0) +
    (hasActivity ? STEP_WEIGHTS.hasActivity : 0) +
    (embedded ? STEP_WEIGHTS.embedded : 0) +
    (creditsPurchased ? STEP_WEIGHTS.creditsPurchased : 0);

  return {
    emailVerified,
    firstProductCreated,
    hasActivity,
    embedded,
    creditsPurchased,
    score,
  };
}

export function isOnboardingComplete(progress: OnboardingProgress): boolean {
  return progress.score === 100;
}

// ---------------------------------------------------------------------------
// 2. Credit runway
// ---------------------------------------------------------------------------

const WINDOW_DAYS = 30;

/**
 * Derives the daily burn rate and days remaining from a wallet ledger slice.
 *
 * `walletHistory` should contain the last 30 days of debit rows for one
 * product. Only rows with a negative delta (debits) are counted.
 *
 * Balance must be passed in separately because the ledger only tracks changes,
 * not the authoritative current value.
 */
export function creditRunway(
  walletHistory: WalletLedgerDoc[],
  balance: number,
): RunwayResult {
  // Sum absolute debits from the window
  const totalSpend = walletHistory
    .filter((row) => row.delta < 0)
    .reduce((sum, row) => sum + Math.abs(row.delta), 0);

  const burnRate = totalSpend / WINDOW_DAYS;

  const daysRemaining = burnRate > 0 ? Math.floor(balance / burnRate) : null;

  return { burnRate, daysRemaining, balance };
}

// ---------------------------------------------------------------------------
// 3. Upsell suggestion
// ---------------------------------------------------------------------------

/**
 * Recommends the next larger pack for the customer's product when runway is low.
 *
 * Triggers when daysRemaining is between 1 and 14 (inclusive), or when the
 * balance has hit zero. Returns null when the runway is comfortable (> 14 days)
 * or when spend is zero.
 *
 * "Larger" means: the pack with the most credits for the same product that costs
 * more than the current average monthly spend.
 */
export function upsellSuggestion(
  runway: RunwayResult,
  packs: CreditPack[],
  product: CreditPack["product"],
): CreditPack | null {
  const { daysRemaining, balance, burnRate } = runway;

  // No spend → no upsell signal
  if (burnRate <= 0) return null;

  // Only trigger when runway is ≤ 14 days, or balance is empty
  const isLowRunway =
    balance === 0 || (daysRemaining !== null && daysRemaining <= 14);

  if (!isLowRunway) return null;

  const productPacks = packs
    .filter((p) => p.product === product)
    .sort((a, b) => a.credits - b.credits);

  if (productPacks.length === 0) return null;

  // Monthly spend estimate
  const monthlySpend = burnRate * 30;

  // Suggest the smallest pack whose credits exceed one month of projected spend
  const suggested = productPacks.find((p) => p.credits > monthlySpend);

  // Fall back to the largest pack if none is big enough
  return suggested ?? productPacks[productPacks.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// 4. Cross-sell suggestion
// ---------------------------------------------------------------------------

const PRODUCT_ORDER: Array<"chatbot" | "forms" | "bookings" | "email"> = [
  "chatbot",
  "forms",
  "bookings",
  "email",
];

/**
 * Suggests an unused product that fits the customer's activity pattern.
 *
 * `activeProducts` is the set of products the customer has already used.
 * Returns the first product in the standard ladder that they have not tried yet,
 * or null when they use everything already.
 */
export function crossSellSuggestion(
  activeProducts: string[],
): "chatbot" | "forms" | "bookings" | "email" | null {
  for (const product of PRODUCT_ORDER) {
    if (!activeProducts.includes(product)) {
      return product;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the number of days since a date. */
export function daysSince(date: Date, now = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}
