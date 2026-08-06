import "server-only";

import { walletBalances, walletLedger } from "@/lib/server/db/collections";
import type {
  WalletLedgerDoc,
  WalletLedgerKind,
  WalletProduct,
} from "@/lib/server/db/types";

/**
 * Prepaid credit accounting, shared by every metered product.
 *
 * Two structures work together:
 *   1. `wallet_balances` — one authoritative counter per owner *per product*,
 *      changed only by an atomic conditional `$inc`. This is what makes
 *      concurrent spending race-safe, and it is the spend circuit-breaker.
 *   2. `wallet_ledger` — an append-only journal. Every change writes a signed
 *      row with the resulting `balanceAfter`, so spend is auditable and never
 *      mutated after the fact.
 *
 * The `product` dimension is load-bearing: chatbot tokens and form-submission
 * credits are separately purchased goods, so they must never draw on one pool.
 * It is part of the balance document's `_id`, which means isolation is enforced
 * by the primary key rather than by every caller remembering to filter.
 *
 * Spending is the security-critical path: two requests must never both spend
 * the last credit. The conditional update below (`balance >= amount` plus
 * `$inc: -amount` in one operation) guarantees exactly one winner under any
 * concurrency — the same technique the rate limiter uses for its window.
 */

/** Composite key, so one product's balance cannot satisfy another's debit. */
export function balanceId(ownerId: string, product: WalletProduct): string {
  return `${ownerId}:${product}`;
}

export interface CreditInput {
  ownerId: string;
  product: WalletProduct;
  amount: number; // positive
  kind: Extract<WalletLedgerKind, "purchase" | "bonus" | "refund">;
  /** The chatbot or form the credit relates to, when relevant. */
  subjectId?: string | null;
  expiresAt?: Date | null;
  note?: string | null;
  now?: Date;
}

export interface DebitInput {
  ownerId: string;
  product: WalletProduct;
  amount: number; // positive
  subjectId?: string | null;
  /** The message or submission this spend paid for. */
  refId?: string | null;
  note?: string | null;
  now?: Date;
}

export type DebitResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; reason: "insufficient" | "invalid-amount"; balance: number };

function isPositiveInt(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

/** Current balance. Zero when the owner has never been credited for it. */
export async function getBalance(
  ownerId: string,
  product: WalletProduct,
): Promise<number> {
  const balances = await walletBalances();
  const doc = await balances.findOne({ _id: balanceId(ownerId, product) });
  return doc?.balance ?? 0;
}

async function appendLedgerRow(
  row: Omit<WalletLedgerDoc, "_id">,
): Promise<void> {
  const ledger = await walletLedger();
  await ledger.insertOne(row as WalletLedgerDoc);
}

/**
 * Adds credits (purchase, bonus, or refund). Upserts the balance counter, then
 * records the journal row. Returns the new balance.
 */
export async function credit(input: CreditInput): Promise<number> {
  if (!isPositiveInt(input.amount)) {
    throw new Error("credit amount must be a positive integer");
  }
  const now = input.now ?? new Date();
  const balances = await walletBalances();

  const updated = await balances.findOneAndUpdate(
    { _id: balanceId(input.ownerId, input.product) },
    {
      $inc: { balance: input.amount },
      $set: { updatedAt: now },
      // Denormalised so the balance row is readable on its own.
      $setOnInsert: { ownerId: input.ownerId, product: input.product },
    },
    { upsert: true, returnDocument: "after" },
  );
  const balanceAfter = updated?.balance ?? input.amount;

  await appendLedgerRow({
    ownerId: input.ownerId,
    product: input.product,
    delta: input.amount,
    kind: input.kind,
    balanceAfter,
    subjectId: input.subjectId ?? null,
    refId: null,
    expiresAt: input.expiresAt ?? null,
    note: input.note ?? null,
    createdAt: now,
  });

  return balanceAfter;
}

/**
 * Spends credits. Atomic and race-safe: when the balance would go negative the
 * conditional `$inc` succeeds for at most one of any number of concurrent
 * callers. Records a signed `deduct` row on success.
 */
export async function debit(input: DebitInput): Promise<DebitResult> {
  if (!isPositiveInt(input.amount)) {
    return {
      ok: false,
      reason: "invalid-amount",
      balance: await getBalance(input.ownerId, input.product),
    };
  }
  const now = input.now ?? new Date();
  const balances = await walletBalances();

  const updated = await balances.findOneAndUpdate(
    {
      _id: balanceId(input.ownerId, input.product),
      balance: { $gte: input.amount },
    },
    { $inc: { balance: -input.amount }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );

  if (!updated) {
    // Either no balance row yet, or insufficient funds. Both are "insufficient".
    return {
      ok: false,
      reason: "insufficient",
      balance: await getBalance(input.ownerId, input.product),
    };
  }

  await appendLedgerRow({
    ownerId: input.ownerId,
    product: input.product,
    delta: -input.amount,
    kind: "deduct",
    balanceAfter: updated.balance,
    subjectId: input.subjectId ?? null,
    refId: input.refId ?? null,
    expiresAt: null,
    note: input.note ?? null,
    createdAt: now,
  });

  return { ok: true, balanceAfter: updated.balance };
}

/** Recent journal rows for one product, newest first — for the usage UI. */
export async function recentLedger(
  ownerId: string,
  product: WalletProduct,
  limit = 50,
): Promise<WalletLedgerDoc[]> {
  const ledger = await walletLedger();
  return ledger
    .find({ ownerId, product })
    .sort({ createdAt: -1 })
    .limit(Math.min(500, Math.max(1, limit)))
    .toArray();
}
