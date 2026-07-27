import "server-only";

import { suppressions } from "@/lib/server/db/collections";
import type { SuppressionDoc } from "@/lib/server/db/types";
import {
  emailDomain,
  normalizeEmail,
  normalizeSuppressionEntry,
} from "@/lib/email/address";

/**
 * The suppression list — the record of who must not be emailed again.
 *
 * Correctness here is the difference between honouring an unsubscribe and
 * committing an offence, so the check is a direct indexed query rather than a
 * cached set: a stale cache entry would let a message go out seconds after
 * someone asked to be removed.
 *
 * The query matches the exact address and the `@domain` wildcard in one round
 * trip, using the unique index on `value`.
 */

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const domain = emailDomain(normalized);

  const candidates = domain ? [normalized, `@${domain}`] : [normalized];

  try {
    const collection = await suppressions();
    const match = await collection.findOne({ value: { $in: candidates } });
    return match !== null;
  } catch {
    // Fail closed. If the list cannot be read, not sending is the safe
    // outcome — the alternative is emailing someone who opted out.
    return true;
  }
}

/** Suppression reasons that came from the recipient rather than from us. */
export type SuppressionReason = SuppressionDoc["reason"];

export async function addSuppression(
  value: string,
  reason: SuppressionReason,
  detail: string | null = null,
): Promise<{ added: boolean; value: string | null }> {
  const normalized = normalizeSuppressionEntry(value);
  if (!normalized) return { added: false, value: null };

  const collection = await suppressions();
  const result = await collection.updateOne(
    { value: normalized },
    {
      $setOnInsert: {
        value: normalized,
        reason,
        detail,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return { added: result.upsertedCount === 1, value: normalized };
}

/**
 * Removes an entry. Only ever used for a correction — an address suppressed by
 * an unsubscribe must not be resurrected without a fresh opt-in.
 */
export async function removeSuppression(value: string): Promise<boolean> {
  const normalized = normalizeSuppressionEntry(value);
  if (!normalized) return false;
  const collection = await suppressions();
  const result = await collection.deleteOne({ value: normalized });
  return result.deletedCount === 1;
}

export async function listSuppressions(limit = 200, skip = 0) {
  const collection = await suppressions();
  return collection
    .find({}, { sort: { createdAt: -1 }, limit, skip })
    .toArray();
}

export async function countSuppressions() {
  const collection = await suppressions();
  return collection.countDocuments();
}
