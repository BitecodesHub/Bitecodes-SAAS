import "server-only";

import * as wallet from "@/lib/server/wallet/wallet";
import type { WalletLedgerDoc, WalletLedgerKind } from "@/lib/server/db/types";

/**
 * Chatbot token accounting.
 *
 * A thin adapter over the shared credit wallet (`server/wallet/wallet.ts`),
 * which owns the atomic-spend guarantee and the append-only journal. This file
 * exists so chatbot callers keep a vocabulary that matches their domain
 * ("tokens", "messages") while a second product (form submissions) draws on
 * its own isolated pool through the same audited implementation.
 */

export interface CreditInput {
  ownerId: string;
  amount: number; // positive
  kind: Extract<WalletLedgerKind, "purchase" | "bonus" | "refund">;
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

export type DeductResult = wallet.DebitResult;

/** Remaining chatbot tokens for an owner. */
export function getBalance(ownerId: string): Promise<number> {
  return wallet.getBalance(ownerId, "chatbot");
}

/** Adds tokens (purchase, bonus, or refund). Returns the new balance. */
export function credit(input: CreditInput): Promise<number> {
  return wallet.credit({
    ownerId: input.ownerId,
    product: "chatbot",
    amount: input.amount,
    kind: input.kind,
    subjectId: input.chatbotId ?? null,
    expiresAt: input.expiresAt ?? null,
    note: input.note ?? null,
    now: input.now,
  });
}

/** Spends tokens. Atomic and race-safe — see `wallet.debit`. */
export function deduct(input: DeductInput): Promise<DeductResult> {
  return wallet.debit({
    ownerId: input.ownerId,
    product: "chatbot",
    amount: input.amount,
    subjectId: input.chatbotId ?? null,
    refId: input.messageId ?? null,
    note: input.note ?? null,
    now: input.now,
  });
}

/** Recent token rows for an owner, newest first. */
export function recentLedger(
  ownerId: string,
  limit = 50,
): Promise<WalletLedgerDoc[]> {
  return wallet.recentLedger(ownerId, "chatbot", limit);
}
