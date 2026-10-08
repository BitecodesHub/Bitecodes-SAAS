"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/server/auth/dal";
import {
  decidePairing,
  findPendingPairing,
  normalizeUserCode,
  revokeDevice,
} from "@/lib/server/desktop/devices";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";

/**
 * Browser-side desktop actions. Server Actions, so Next's Origin check gives
 * CSRF protection: a malicious page cannot auto-approve a pairing on a signed-in
 * user's behalf.
 */

export type PairDecision =
  | { ok: true; status: "approved" | "denied" }
  | { ok: false; error: string };

export async function decidePairingAction(input: {
  userCode: string;
  approve: boolean;
}): Promise<PairDecision> {
  const session = await requireAdminSession();
  const limit = await consumeNamedRateLimit("desktopApprove", session.userId);
  if (!limit.allowed)
    return { ok: false, error: "Too many attempts. Try again shortly." };
  const result = await decidePairing({
    userCode: String(input.userCode ?? ""),
    userId: session.userId,
    approve: Boolean(input.approve),
  });
  if (result === "not-found") {
    return {
      ok: false,
      error:
        "This code has expired or was already used. Start sign-in again from the app.",
    };
  }
  await recordAudit({
    action: AUDIT_ACTIONS.desktopPairing,
    actorId: session.userId,
    detail: { outcome: result },
  }).catch(() => {});
  return { ok: true, status: result };
}

export async function revokeDeviceAction(id: string): Promise<{ ok: boolean }> {
  const session = await requireAdminSession();
  const ok = await revokeDevice(session.userId, String(id ?? ""));
  revalidatePath("/app/desktop");
  return { ok };
}

export type PairLookup =
  | {
      ok: true;
      pending: {
        label: string;
        userCode: string;
        requestedFrom: string | null;
        createdAtIso: string;
      };
    }
  | { ok: false; error: string };

/**
 * Looks up the sign-in request behind a code the user TYPED (never one from a
 * link). Shares the approval rate limit, so codes cannot be enumerated.
 */
export async function lookupPairingAction(code: string): Promise<PairLookup> {
  const session = await requireAdminSession();
  const limit = await consumeNamedRateLimit("desktopApprove", session.userId);
  if (!limit.allowed)
    return { ok: false, error: "Too many attempts. Try again shortly." };
  if (!normalizeUserCode(String(code ?? ""))) {
    return {
      ok: false,
      error: "Enter the 8-character code shown in the desktop app.",
    };
  }
  const pending = await findPendingPairing(String(code));
  if (!pending) {
    return {
      ok: false,
      error:
        "No sign-in is waiting for that code. Check it, or start sign-in again from the app.",
    };
  }
  return {
    ok: true,
    pending: {
      label: pending.label,
      userCode: pending.userCode,
      requestedFrom: pending.requestedFrom,
      createdAtIso: pending.createdAt.toISOString(),
    },
  };
}
