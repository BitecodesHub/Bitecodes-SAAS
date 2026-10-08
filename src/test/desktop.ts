import type { AdminRole } from "@/lib/server/db/types";

/**
 * A real, active account for desktop tests: device tokens are now bound to
 * the account (status + sessionEpoch), so fake user ids no longer verify.
 */
export async function createTestUser(
  role: AdminRole = "owner",
  email?: string,
): Promise<string> {
  const { adminUsers } = await import("@/lib/server/db/collections");
  const now = new Date();
  const res = await (
    await adminUsers()
  ).insertOne({
    email:
      email ?? `desktop-${Math.random().toString(36).slice(2)}@example.test`,
    name: "Desktop Test",
    role,
    passwordHash: "x",
    status: "active",
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    sessionEpoch: 0,
    createdAt: now,
    updatedAt: now,
  });
  return res.insertedId.toHexString();
}
