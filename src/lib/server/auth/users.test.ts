import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { AdminRole } from "@/lib/server/db/types";

/**
 * The account-management rules are a security boundary, so they are pinned here
 * rather than left to the UI. The two that matter: you cannot lock yourself
 * out, and the last active owner cannot be removed by anyone.
 */
describeWithDatabase("admin user management", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { adminUsers, adminSessions } =
      await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await (await adminSessions()).deleteMany({});
  });

  async function seed(email: string, role: AdminRole) {
    const { createAdminUser } = await import("@/lib/server/auth/users");
    const result = await createAdminUser({ email, name: email, role });
    if (!result.ok) throw new Error(result.error);
    return result.user.id;
  }

  it("creates an account with a one-time password and no duplicate email", async () => {
    const { createAdminUser } = await import("@/lib/server/auth/users");

    const first = await createAdminUser({
      email: "Hire@Example.com",
      name: "New Hire",
      role: "editor",
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.user.email).toBe("hire@example.com");
      expect(first.password.length).toBeGreaterThanOrEqual(24);
    }

    const dup = await createAdminUser({
      email: "hire@example.com",
      name: "Again",
      role: "viewer",
    });
    expect(dup.ok).toBe(false);
  });

  it("refuses to demote or disable the only active owner", async () => {
    const { setAdminRole, setAdminStatus } =
      await import("@/lib/server/auth/users");
    const ownerId = await seed("owner@example.com", "owner");
    const actor = await seed("other@example.com", "admin");

    expect((await setAdminRole(ownerId, "admin", actor)).ok).toBe(false);
    expect((await setAdminStatus(ownerId, "disabled", actor)).ok).toBe(false);
  });

  it("allows demoting an owner once a second owner exists", async () => {
    const { setAdminRole } = await import("@/lib/server/auth/users");
    const ownerId = await seed("owner@example.com", "owner");
    await seed("owner2@example.com", "owner");
    const actor = await seed("admin@example.com", "admin");

    expect((await setAdminRole(ownerId, "editor", actor)).ok).toBe(true);
  });

  it("refuses self role change, self disable, and self password reset", async () => {
    const { setAdminRole, setAdminStatus, resetAdminPassword } =
      await import("@/lib/server/auth/users");
    const meId = await seed("me@example.com", "owner");
    await seed("backup-owner@example.com", "owner");

    expect((await setAdminRole(meId, "admin", meId)).ok).toBe(false);
    expect((await setAdminStatus(meId, "disabled", meId)).ok).toBe(false);
    expect((await resetAdminPassword(meId, meId)).ok).toBe(false);
  });

  it("resets a password, rotates the session epoch, and revokes sessions", async () => {
    const { resetAdminPassword } = await import("@/lib/server/auth/users");
    const { adminUsers, adminSessions } =
      await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");

    const targetId = await seed("target@example.com", "editor");
    const actorId = await seed("actor@example.com", "owner");

    const before = await (
      await adminUsers()
    ).findOne({
      _id: new ObjectId(targetId),
    });
    // A live session that the reset must invalidate.
    await (
      await adminSessions()
    ).insertOne({
      tokenHash: "hash",
      userId: targetId,
      role: "editor",
      sessionEpoch: before?.sessionEpoch ?? 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
    } as never);

    const result = await resetAdminPassword(targetId, actorId);
    expect(result.ok).toBe(true);

    const after = await (
      await adminUsers()
    ).findOne({
      _id: new ObjectId(targetId),
    });
    expect(after?.sessionEpoch).toBe((before?.sessionEpoch ?? 1) + 1);

    const live = await (
      await adminSessions()
    ).countDocuments({
      userId: targetId,
      revokedAt: null,
    });
    expect(live).toBe(0);
  });
});
