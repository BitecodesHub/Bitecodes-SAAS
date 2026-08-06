import "server-only";

import {
  chatbotBalances,
  chatbotTokenLedger,
} from "@/lib/server/db/collections";
import type { TokenLedgerDoc, TokenLedgerKind } from "@/lib/server/db/types";

/**
 * Token accounting for the chatbot SaaS.
 *
 * Two structures work together:
 *   1. `chatbot_balances` — one authoritative counter per owner, changed only
 *      by an atomic conditional `$inc`. This is what makes concurrent
 *      deductions race-safe and is the spend circuit-breaker.
 *   2. `chatbot_token_ledger` — an append-only journal. Every change writes a
 *      signed row with the resulting `balanceAfter`, so spend is fully
 *      auditable and never mutated after the fact.
 *
 * Deduction is the security-critical path: two requests must never both spend
 * the last of a balance. The conditional update below (`balance >= amount`
 * plus `$inc: -amount` in one operation) guarantees exactly one winner under
 * any concurrency, the same technique the rate limiter uses for its window.
 */

export interface CreditInput {
  ownerId: string;
  amount: number; // positive
  kind: Extract<TokenLedgerKind, "purchase" | "bonus" | "refund">;
  chatbotId?: string | null;
  expiresAt?: Date | null;
  note?: string | null;
  now?: Date;
}

export interface DeductInput {
  ownerId: string;
  amount: number; // positive
  chatbotId?: string | null;
  messageId?: string | null;
  note?: string | null;
  now?: Date;
}

export type DeductResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; reason: "insufficient" | "invalid-amount"; balance: number };

function assertPositiveInt(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

/** Current balance for an owner. Zero when the owner has never been credited. */
export async function getBalance(ownerId: string): Promise<number> {
  const balances = await chatbotBalances();
  const doc = await balances.findOne({ _id: ownerId });
  return doc?.balance ?? 0;
}

async function appendLedgerRow(
  row: Omit<TokenLedgerDoc, "_id">,
): Promise<void> {
  const ledger = await chatbotTokenLedger();
  await ledger.insertOne(row as TokenLedgerDoc);
}

/**
 * Adds tokens (purchase, bonus, or refund). Upserts the balance counter, then
 * records the journal row. Returns the new balance.
 */
export async function credit(input: CreditInput): Promise<number> {
  if (!assertPositiveInt(input.amount)) {
    throw new Error("credit amount must be a positive integer");
  }
  const now = input.now ?? new Date();
  const balances = await chatbotBalances();

  const updated = await balances.findOneAndUpdate(
    { _id: input.ownerId },
    { $inc: { balance: input.amount }, $set: { updatedAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  const balanceAfter = updated?.balance ?? input.amount;

  await appendLedgerRow({
    ownerId: input.ownerId,
    delta: input.amount,
    kind: input.kind,
    balanceAfter,
    chatbotId: input.chatbotId ?? null,
    messageId: null,
    expiresAt: input.expiresAt ?? null,
    note: input.note ?? null,
    createdAt: now,
  });

  return balanceAfter;
}

/**
 * Spends tokens. Atomic and race-safe: the conditional `$inc` succeeds for at
 * most one of any number of concurrent callers when the balance would go
 * negative. Records a signed `deduct` row on success.
 */
export async function deduct(input: DeductInput): Promise<DeductResult> {
  if (!assertPositiveInt(input.amount)) {
    return {
      ok: false,
      reason: "invalid-amount",
      balance: await getBalance(input.ownerId),
    };
  }
  const now = input.now ?? new Date();
  const balances = await chatbotBalances();

  const updated = await balances.findOneAndUpdate(
    { _id: input.ownerId, balance: { $gte: input.amount } },
    { $inc: { balance: -input.amount }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );

  if (!updated) {
    // Either no balance row yet, or insufficient funds. Both are "insufficient".
    return {
      ok: false,
      reason: "insufficient",
      balance: await getBalance(input.ownerId),
    };
  }

  await appendLedgerRow({
    ownerId: input.ownerId,
    delta: -input.amount,
    kind: "deduct",
    balanceAfter: updated.balance,
    chatbotId: input.chatbotId ?? null,
    messageId: input.messageId ?? null,
    expiresAt: null,
    note: input.note ?? null,
    createdAt: now,
  });

  return { ok: true, balanceAfter: updated.balance };
}

/** Recent ledger rows for an owner, newest first — for the usage/billing UI. */
export async function recentLedger(
  ownerId: string,
  limit = 50,
): Promise<TokenLedgerDoc[]> {
  const ledger = await chatbotTokenLedger();
  return ledger
    .find({ ownerId })
    .sort({ createdAt: -1 })
    .limit(Math.min(500, Math.max(1, limit)))
    .toArray();
}
