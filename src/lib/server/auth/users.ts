import "server-only";

import { ObjectId } from "mongodb";
import { adminUsers } from "@/lib/server/db/collections";
import type { AdminRole, AdminUserDoc } from "@/lib/server/db/types";
import { hashPassword, randomToken } from "@/lib/server/crypto";
import { revokeAllSessions } from "@/lib/server/auth/session";

/**
 * Admin account management.
 *
 * The same operations as `scripts/admin.mjs`, in the application so an owner
 * can hire someone without a terminal. The CLI stays: it is how the first
 * account gets created, and how an owner locked out of everything gets back
 * in. Both write the same documents, so neither can drift from the other's
 * password format without breaking login for both.
 *
 * Two rules are enforced here rather than in the UI, because the UI is not a
 * security boundary:
 *
 * - Nobody may disable, demote, or reset the account they are signed in with.
 *   Locking yourself out is not a capability anyone needs, and "I demoted
 *   myself and now nobody can manage users" is a support call with no
 *   self-service fix.
 * - The last active owner can never be disabled or demoted, by anyone. An
 *   installation with no owner cannot manage its own accounts again except
 *   through the CLI.
 */

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: AdminUserDoc["status"];
  twoFactorEnabled: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

function toSummary(doc: AdminUserDoc): AdminUserSummary {
  return {
    id: doc._id?.toHexString() ?? "",
    email: doc.email,
    name: doc.name,
    role: doc.role,
    status: doc.status,
    twoFactorEnabled: Boolean(doc.totpEnabledAt),
    lockedUntil:
      doc.lockedUntil && doc.lockedUntil > new Date()
        ? doc.lockedUntil.toISOString()
        : null,
    lastLoginAt: doc.lastLoginAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const collection = await adminUsers();
  const all = await collection.find({}).sort({ createdAt: 1 }).toArray();
  return all.map(toSummary);
}

/** A 24-byte random password, shown once and meant for a password manager. */
function generatePassword(): string {
  return randomToken(24);
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  role: AdminRole;
}): Promise<
  | { ok: true; user: AdminUserSummary; password: string }
  | { ok: false; error: string }
> {
  const collection = await adminUsers();
  const email = input.email.trim().toLowerCase();

  const existing = await collection.findOne({ email });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const password = generatePassword();
  const now = new Date();
  const document: Omit<AdminUserDoc, "_id"> = {
    email,
    name: input.name.trim() || email.split("@")[0],
    role: input.role,
    passwordHash: await hashPassword(password),
    status: "active",
    totpSecret: null,
    totpEnabledAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    sessionEpoch: 1,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await collection.insertOne(document as AdminUserDoc);
  return {
    ok: true,
    user: toSummary({ ...document, _id: inserted.insertedId } as AdminUserDoc),
    password,
  };
}

async function countOtherActiveOwners(excludeId: ObjectId): Promise<number> {
  const collection = await adminUsers();
  return collection.countDocuments({
    _id: { $ne: excludeId },
    role: "owner",
    status: "active",
  });
}

export async function resetAdminPassword(
  userId: string,
  actorId: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  if (userId === actorId) {
    return {
      ok: false,
      error: "Reset your own password from the login page, not from here.",
    };
  }

  const collection = await adminUsers();
  const id = new ObjectId(userId);
  const password = generatePassword();

  const result = await collection.updateOne(
    { _id: id },
    {
      $set: {
        passwordHash: await hashPassword(password),
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
      // Every session issued against the old password stops validating.
      $inc: { sessionEpoch: 1 },
    },
  );
  if (result.matchedCount === 0) {
    return { ok: false, error: "That account no longer exists." };
  }

  await revokeAllSessions(userId);
  return { ok: true, password };
}

export async function setAdminRole(
  userId: string,
  role: AdminRole,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userId === actorId) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const collection = await adminUsers();
  const id = new ObjectId(userId);
  const user = await collection.findOne({ _id: id });
  if (!user) return { ok: false, error: "That account no longer exists." };

  if (
    user.role === "owner" &&
    role !== "owner" &&
    (await countOtherActiveOwners(id)) === 0
  ) {
    return {
      ok: false,
      error: "This is the only active owner. Promote someone else first.",
    };
  }

  await collection.updateOne(
    { _id: id },
    { $set: { role, updatedAt: new Date() } },
  );
  return { ok: true };
}

export async function setAdminStatus(
  userId: string,
  status: "active" | "disabled",
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userId === actorId) {
    return { ok: false, error: "You cannot disable your own account." };
  }

  const collection = await adminUsers();
  const id = new ObjectId(userId);
  const user = await collection.findOne({ _id: id });
  if (!user) return { ok: false, error: "That account no longer exists." };

  if (
    status === "disabled" &&
    user.role === "owner" &&
    user.status === "active" &&
    (await countOtherActiveOwners(id)) === 0
  ) {
    return {
      ok: false,
      error: "This is the only active owner and cannot be disabled.",
    };
  }

  await collection.updateOne(
    { _id: id },
    { $set: { status, updatedAt: new Date() } },
  );

  if (status === "disabled") await revokeAllSessions(userId);
  return { ok: true };
}

export async function unlockAdminUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const collection = await adminUsers();
  const result = await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { failedAttempts: 0, lockedUntil: null, updatedAt: new Date() } },
  );
  return result.matchedCount === 0
    ? { ok: false, error: "That account no longer exists." }
    : { ok: true };
}
