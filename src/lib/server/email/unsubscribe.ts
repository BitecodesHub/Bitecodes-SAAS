import "server-only";

import { verifySignedTokenIgnoringExpiry } from "@/lib/server/tokens";
import { addSuppression } from "@/lib/server/email/suppression";
import { setProspectStatus } from "@/lib/server/prospecting/repository";

/**
 * The opt-out action, shared by the human-facing page and the machine-facing
 * one-click endpoint.
 *
 * One implementation on purpose. RFC 8058 requires that the URI advertised in
 * `List-Unsubscribe` accept a POST carrying `List-Unsubscribe=One-Click`, which
 * is what Gmail and Yahoo send on the recipient's behalf. If that path and the
 * path a human clicks could ever disagree about what "unsubscribed" means, some
 * recipients would keep receiving mail after opting out.
 */

export type UnsubscribeOutcome =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "unreadable" | "storage-failed" };

/**
 * Verifies the token and suppresses the address.
 *
 * An expired token is still honoured. Unsubscribe tokens are minted without an
 * expiry precisely so this cannot arise, but if one ever did, the recipient's
 * intent matters more than the clock — and refusing would be indefensible.
 */
export async function applyUnsubscribe(
  token: string | null | undefined,
): Promise<UnsubscribeOutcome> {
  // Expiry is ignored on purpose — see `verifySignedTokenIgnoringExpiry`. The
  // signature is still required, so a forged token is refused.
  const verified = verifySignedTokenIgnoringExpiry<{
    e: string;
    id?: string;
  }>(token, "unsubscribe");

  if (!verified.ok) return { ok: false, reason: "invalid" };

  const email = String(verified.data.e ?? "").trim();
  if (!email) return { ok: false, reason: "unreadable" };

  const prospectId = verified.data.id;

  // Suppression first. It is the list the sender actually consults, so if only
  // one of these two writes can succeed, it must be this one.
  try {
    const result = await addSuppression(
      email,
      "unsubscribed",
      "One-click link",
    );
    if (!result.value) return { ok: false, reason: "storage-failed" };
  } catch {
    return { ok: false, reason: "storage-failed" };
  }

  // Halt any running sequence for this address. Suppression alone would already
  // stop each send, but leaving enrolments "active" would mean the tick keeps
  // waking them up, and the admin panel would report people as being mid-sequence
  // when they have in fact opted out.
  try {
    const { stopEnrollmentsForEmail } =
      await import("@/lib/server/email/sequences");
    await stopEnrollmentsForEmail(email);
  } catch {
    // Suppression is the guarantee; this is tidiness.
  }

  if (prospectId) {
    try {
      await setProspectStatus([String(prospectId)], "suppressed");
    } catch {
      // Cosmetic for the admin pipeline view. Mail is already stopped.
    }
  }

  return { ok: true, email };
}
