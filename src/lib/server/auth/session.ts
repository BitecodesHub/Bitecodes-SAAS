import "server-only";

import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { adminSessions, adminUsers } from "@/lib/server/db/collections";
import type { AdminRole } from "@/lib/server/db/types";
import { hashIp, randomToken, sha256Hex } from "@/lib/server/crypto";

/**
 * Admin session management.
 *
 * Sessions are **opaque random tokens**, not signed JWTs. The token is stored
 * only as its SHA-256 hash, so a database leak does not hand over usable
 * sessions, and — the reason that matters most here — a session can be revoked
 * server-side the instant a password changes or an account is disabled. A
 * self-contained JWT stays valid until it expires no matter what happens to the
 * account behind it.
 *
 * Three independent invalidation paths, so no single missed update leaves a
 * session alive:
 *
 * 1. `expiresAt` — sliding idle timeout, also enforced by a MongoDB TTL index.
 * 2. `revokedAt` — explicit sign-out, or revoke-all on password change.
 * 3. `sessionEpoch` — bumped on the user record by a password reset, which
 *    invalidates every session ever issued to that account at once.
 */

export const SESSION_COOKIE = "bc_admin";

/** Idle timeout. Refreshed on activity, so an active operator is not logged out. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hard ceiling regardless of activity. A session that has existed this long is
 * re-authenticated even if it has been used every day.
 */
const SESSION_ABSOLUTE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

/** Only refresh when this much of the window has elapsed, to avoid a write per request. */
const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface AdminSessionInfo {
  userId: string;
  role: AdminRole;
}

/**
 * Issues a session and sets the cookie.
 *
 * `secure` is conditional on production only so that local development over
 * plain HTTP works; every other flag is unconditional.
 */
export async function createAdminSession({
  userId,
  role,
  sessionEpoch,
  ip,
  userAgent,
}: {
  userId: string;
  role: AdminRole;
  sessionEpoch: number;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const collection = await adminSessions();
  await collection.insertOne({
    tokenHash: sha256Hex(token),
    userId,
    role,
    sessionEpoch,
    ipHash: hashIp(ip),
    // Bounded: a User-Agent is attacker-controlled and can be arbitrarily long.
    userAgent: userAgent?.slice(0, 300) ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    revokedAt: null,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` rather than `strict`: `strict` would drop the cookie when an
    // operator follows a link to the admin panel from an email notification,
    // which reads as a random logout. `lax` still blocks cross-site POSTs.
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Validates the current session cookie against the database.
 *
 * Returns null rather than throwing for every failure mode, so callers cannot
 * accidentally treat "no session" as an unexpected error. Wrap in the DAL's
 * cached `verifyAdminSession` rather than calling this per component — this hits
 * the database each time.
 */
export async function readAdminSession(): Promise<AdminSessionInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();

  try {
    const sessions = await adminSessions();
    const session = await sessions.findOne({ tokenHash: sha256Hex(token) });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt <= now) return null;
    if (
      session.createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS <=
      now.getTime()
    ) {
      return null;
    }

    // The user record is authoritative for role and status: a demotion or a
    // disabled account must take effect immediately, not at next sign-in.
    const users = await adminUsers();
    const user = await users.findOne(
      { _id: new ObjectId(session.userId) },
      { projection: { role: 1, status: 1, sessionEpoch: 1 } },
    );

    if (!user || user.status !== "active") return null;
    if (user.sessionEpoch !== session.sessionEpoch) return null;

    if (
      now.getTime() - session.lastSeenAt.getTime() >
      SESSION_REFRESH_AFTER_MS
    ) {
      await sessions.updateOne(
        { _id: session._id },
        {
          $set: {
            lastSeenAt: now,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
            // Keep the cached role in step with the user record.
            role: user.role,
          },
        },
      );
    }

    return { userId: session.userId, role: user.role };
  } catch {
    // A database outage must read as "not signed in", never as "signed in".
    return null;
  }
}

/** Signs the current session out and clears the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const sessions = await adminSessions();
      await sessions.updateOne(
        { tokenHash: sha256Hex(token) },
        { $set: { revokedAt: new Date() } },
      );
    } catch {
      // Clearing the cookie below still signs this browser out.
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Revokes every session for a user. Called on password change and when an
 * account is disabled.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const sessions = await adminSessions();
  const result = await sessions.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function revokeSessionById(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const sessions = await adminSessions();
  const result = await sessions.updateOne(
    // Scoped to the owning user so one operator cannot revoke another's
    // session by guessing an id.
    { _id: new ObjectId(sessionId), userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

/** Active sessions for the account settings page. */
export async function listActiveSessions(userId: string) {
  const sessions = await adminSessions();
  return sessions
    .find(
      { userId, revokedAt: null, expiresAt: { $gt: new Date() } },
      // The token hash is never returned, even internally.
      { projection: { tokenHash: 0 }, sort: { lastSeenAt: -1 }, limit: 50 },
    )
    .toArray();
}

/** True when the request carries the session cookie at all. */
export async function hasSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(SESSION_COOKIE)?.value);
}
