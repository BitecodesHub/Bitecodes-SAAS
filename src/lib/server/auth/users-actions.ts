"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { ROLE_ORDER } from "@/lib/server/auth/roles";
import {
  createAdminUser,
  resetAdminPassword,
  setAdminRole,
  setAdminStatus,
  unlockAdminUser,
} from "@/lib/server/auth/users";
import type { AdminRole } from "@/lib/server/db/types";

/**
 * Server Actions for the team page. All of them are `manage_users`, which only
 * owners hold: creating an account, or changing what an existing one may do,
 * is how every other permission gets granted.
 *
 * Generated passwords pass through here exactly once, in the return value, and
 * are never logged or audited.
 */

export type TeamActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/);

const roleSchema = z.enum(ROLE_ORDER as [AdminRole, ...AdminRole[]]);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Enter their name.").max(100),
  role: roleSchema,
});

export async function createTeamMemberAction(input: {
  email: string;
  name: string;
  role: string;
}): Promise<TeamActionResult<{ password: string; email: string }>> {
  const session = await assertCapability("manage_users");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const result = await createAdminUser(parsed.data);
  if (!result.ok) return result;

  await recordAudit({
    action: AUDIT_ACTIONS.userInvited,
    actorId: session.userId,
    target: { type: "admin_user", id: result.user.email },
    detail: { role: result.user.role },
  });

  revalidatePath("/admin/users");
  return {
    ok: true,
    data: { password: result.password, email: result.user.email },
  };
}

export async function setTeamRoleAction(
  userId: string,
  role: string,
): Promise<TeamActionResult> {
  const session = await assertCapability("manage_users");

  const id = objectIdSchema.safeParse(userId);
  const parsedRole = roleSchema.safeParse(role);
  if (!id.success || !parsedRole.success) {
    return { ok: false, error: "Check the request and try again." };
  }

  const result = await setAdminRole(id.data, parsedRole.data, session.userId);
  if (!result.ok) return result;

  await recordAudit({
    action: AUDIT_ACTIONS.userRoleChanged,
    actorId: session.userId,
    target: { type: "admin_user", id: id.data },
    detail: { role: parsedRole.data },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setTeamStatusAction(
  userId: string,
  status: "active" | "disabled",
): Promise<TeamActionResult> {
  const session = await assertCapability("manage_users");

  const id = objectIdSchema.safeParse(userId);
  if (!id.success || !["active", "disabled"].includes(status)) {
    return { ok: false, error: "Check the request and try again." };
  }

  const result = await setAdminStatus(id.data, status, session.userId);
  if (!result.ok) return result;

  await recordAudit({
    action:
      status === "disabled"
        ? AUDIT_ACTIONS.userDisabled
        : AUDIT_ACTIONS.userEnabled,
    actorId: session.userId,
    target: { type: "admin_user", id: id.data },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetTeamPasswordAction(
  userId: string,
): Promise<TeamActionResult<{ password: string }>> {
  const session = await assertCapability("manage_users");

  const id = objectIdSchema.safeParse(userId);
  if (!id.success) {
    return { ok: false, error: "Check the request and try again." };
  }

  const result = await resetAdminPassword(id.data, session.userId);
  if (!result.ok) return result;

  await recordAudit({
    action: AUDIT_ACTIONS.passwordChanged,
    actorId: session.userId,
    target: { type: "admin_user", id: id.data },
    detail: { by: "reset" },
  });

  revalidatePath("/admin/users");
  return { ok: true, data: { password: result.password } };
}

export async function unlockTeamMemberAction(
  userId: string,
): Promise<TeamActionResult> {
  const session = await assertCapability("manage_users");

  const id = objectIdSchema.safeParse(userId);
  if (!id.success) {
    return { ok: false, error: "Check the request and try again." };
  }

  const result = await unlockAdminUser(id.data);
  if (!result.ok) return result;

  await recordAudit({
    action: AUDIT_ACTIONS.sessionRevoked,
    actorId: session.userId,
    target: { type: "admin_user", id: id.data },
    detail: { by: "unlock" },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
