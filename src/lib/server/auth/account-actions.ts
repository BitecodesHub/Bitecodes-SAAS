"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdminSession } from "@/lib/server/auth/dal";
import {
  changeAdminPassword,
  verifyCurrentPassword,
} from "@/lib/server/auth/login";
import { revokeSessionById } from "@/lib/server/auth/session";
import { adminUsers } from "@/lib/server/db/collections";
import { validatePasswordStrength } from "@/lib/server/crypto";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";

/**
 * Actions an account holder performs on their own account.
 *
 * Distinct from `users-actions.ts`, which is how an owner acts on *somebody
 * else's* account. The two have opposite defaults: there, the acting user must
 * hold `manage_users` and may not target themselves; here, no capability is
 * required beyond being signed in, and the target is always the caller.
 *
 * "Always the caller" is enforced by never accepting a user id as input. There
 * is no parameter an attacker could point at another account.
 */

export type AccountActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const passwordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(1).max(200),
  confirm: z.string().min(1).max(200),
});

export async function changeOwnPasswordAction(input: {
  current: string;
  next: string;
  confirm: string;
}): Promise<AccountActionResult> {
  const session = await requireAdminSession();

  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Fill in all three fields." };
  }
  if (parsed.data.next !== parsed.data.confirm) {
    return { ok: false, error: "The two new passwords do not match." };
  }

  // The current password is checked before the new one is validated, so a
  // stranger at an unlocked screen learns nothing about our password rules
  // without first knowing the password.
  const valid = await verifyCurrentPassword(
    session.userId,
    parsed.data.current,
  );
  if (!valid) {
    return { ok: false, error: "That is not your current password." };
  }

  const problems = validatePasswordStrength(parsed.data.next);
  if (problems.length > 0) {
    return { ok: false, error: problems.join(" ") };
  }

  if (parsed.data.next === parsed.data.current) {
    return { ok: false, error: "Choose a password you have not used here." };
  }

  // Bumps `sessionEpoch` and revokes every session, including this one. That is
  // the point of changing a password: whoever else had it is signed out too.
  await changeAdminPassword(session.userId, parsed.data.next);

  await recordAudit({
    action: AUDIT_ACTIONS.passwordChanged,
    actorId: session.userId,
    detail: { via: "account-settings" },
  });

  return {
    ok: true,
    message:
      "Password changed. Every device, including this one, has been signed out.",
  };
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  company: z.string().trim().max(120).optional(),
});

export async function updateOwnProfileAction(input: {
  name: string;
  company?: string;
}): Promise<AccountActionResult> {
  const session = await requireAdminSession();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give a name of at least two characters." };
  }

  // The email address is deliberately not editable here. Changing it is a
  // change of identity and would need the new address proven before the old one
  // stopped working, which is a flow of its own rather than a text field.
  await (
    await adminUsers()
  ).updateOne(
    { _id: new ObjectId(session.userId) },
    {
      $set: {
        name: parsed.data.name,
        company: parsed.data.company?.trim() || null,
        updatedAt: new Date(),
      },
    },
  );

  revalidatePath("/app/settings");
  return { ok: true, message: "Saved." };
}

export async function revokeOwnSessionAction(
  sessionId: string,
): Promise<AccountActionResult> {
  const session = await requireAdminSession();
  if (typeof sessionId !== "string" || !ObjectId.isValid(sessionId)) {
    return { ok: false, error: "That session no longer exists." };
  }

  // Scoped to the caller's own user id inside the query, so a guessed id
  // belonging to somebody else matches nothing.
  const done = await revokeSessionById(sessionId, session.userId);
  if (!done) return { ok: false, error: "That session has already ended." };

  await recordAudit({
    action: AUDIT_ACTIONS.sessionRevoked,
    actorId: session.userId,
  });

  revalidatePath("/app/settings");
  return { ok: true, message: "Signed that device out." };
}
