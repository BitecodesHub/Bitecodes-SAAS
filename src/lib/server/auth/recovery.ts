import "server-only";

import { ObjectId } from "mongodb";
import { adminTokens, adminUsers } from "@/lib/server/db/collections";
import type { AdminRole, AdminTokenDoc } from "@/lib/server/db/types";
import { hashPassword, randomToken, sha256Hex } from "@/lib/server/crypto";
import { revokeAllSessions } from "@/lib/server/auth/session";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { siteConfig } from "@/lib/site";

/**
 * Account recovery: password reset and one-click sign-in links.
 *
 * Tokens are **opaque random strings stored only as SHA-256 hashes** in
 * `admin_tokens`, not stateless signed tokens. The database record is what
 * makes a link single-use: consumption is a `findOneAndUpdate` on
 * `usedAt: null`, so two concurrent clicks on the same link cannot both win.
 * A leaked database exposes only hashes, which cannot be turned back into
 * working links.
 *
 * Every "request a link" entry point answers identically whether or not the
 * address has an account. A distinct answer would let anyone enumerate the
 * panel's operator emails — the same rule `authenticateAdmin` follows.
 */

const RESET_TTL_MS = 60 * 60 * 1000;
/** Shorter than reset: a sign-in link IS a session, not a step towards one. */
const LOGIN_LINK_TTL_MS = 15 * 60 * 1000;

async function createToken(
  userId: string,
  purpose: AdminTokenDoc["purpose"],
  ttlMs: number,
): Promise<string> {
  const token = randomToken(32);
  const now = new Date();

  const collection = await adminTokens();
  await collection.insertOne({
    tokenHash: sha256Hex(token),
    userId,
    purpose,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
    usedAt: null,
  });

  return token;
}

/**
 * Consumes a token atomically. Returns the owning user id, or null when the
 * token is unknown, expired, already used, or issued for another purpose.
 */
export async function consumeToken(
  token: string,
  purpose: AdminTokenDoc["purpose"],
): Promise<string | null> {
  if (!token || token.length > 200) return null;

  const collection = await adminTokens();
  const claimed = await collection.findOneAndUpdate(
    {
      tokenHash: sha256Hex(token),
      purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
  );

  return claimed?.userId ?? null;
}

/**
 * Peeks at a token without consuming it, so the magic-link landing page can
 * show "this link has expired" before the visitor commits. Never treat a
 * successful peek as authentication — only `consumeToken` grants anything.
 */
export async function peekToken(
  token: string,
  purpose: AdminTokenDoc["purpose"],
): Promise<boolean> {
  if (!token || token.length > 200) return false;

  const collection = await adminTokens();
  const found = await collection.findOne({
    tokenHash: sha256Hex(token),
    purpose,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  return Boolean(found);
}

async function findActiveUserByEmail(email: string) {
  const collection = await adminUsers();
  const user = await collection.findOne({
    email: email.trim().toLowerCase(),
  });
  return user && user.status === "active" ? user : null;
}

/**
 * Where a recovery link lands, which depends on who is recovering.
 *
 * Staff reset inside `/admin`; customers reset on the public site. Sending a
 * customer to `/admin/reset` would work — the token is what authorises the
 * change — but it would show them a page branded for staff and then drop them
 * on a sign-in form they are not allowed to use.
 */
function areaFor(role: AdminRole): "/admin" | "" {
  return role === "customer" ? "" : "/admin";
}

/**
 * Emails a password-reset link if — and only if — the address has an active
 * account. Resolves either way; the caller must not reveal which happened.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findActiveUserByEmail(email);
  if (!user?._id) return;

  const token = await createToken(
    user._id.toHexString(),
    "password-reset",
    RESET_TTL_MS,
  );
  const url = `${getSiteUrl()}${areaFor(user.role)}/reset/${token}`;

  await queueEmail({
    to: user.email,
    toName: user.name,
    subject: `Reset your ${siteConfig.name} password`,
    blocks: [
      {
        type: "p",
        text: `Someone asked to reset the password for the ${siteConfig.name} account belonging to this address. If that was you, use the button below within the next hour.`,
      },
      { type: "cta", label: "Choose a new password", url },
      {
        type: "p",
        text: "If you did not ask for this, you can ignore this email — your password has not changed and the link works only once.",
      },
    ],
    category: "transactional",
    skipApproval: true,
    track: false,
  });
}

/**
 * Emails a one-click sign-in link if the address has an active account.
 * Same uniform-response contract as `requestPasswordReset`.
 */
export async function requestLoginLink(email: string): Promise<void> {
  const user = await findActiveUserByEmail(email);
  if (!user?._id) return;

  const token = await createToken(
    user._id.toHexString(),
    "login-link",
    LOGIN_LINK_TTL_MS,
  );
  const url = `${getSiteUrl()}${areaFor(user.role)}/login/link?token=${encodeURIComponent(token)}`;

  await queueEmail({
    to: user.email,
    toName: user.name,
    subject: `Your ${siteConfig.name} sign-in link`,
    blocks: [
      {
        type: "p",
        text: `Use the button below to sign in to ${siteConfig.name}. The link works once and expires in 15 minutes.`,
      },
      { type: "cta", label: "Sign in", url },
      {
        type: "p",
        text: "If you did not ask for this link, ignore this email — nobody can sign in without it.",
      },
    ],
    category: "transactional",
    skipApproval: true,
    track: false,
  });
}

export type ResetOutcome =
  | { ok: true; userId: string; email: string; role: AdminRole }
  | { ok: false; reason: "invalid-token" | "no-account" };

/**
 * Sets a new password from a reset token.
 *
 * The token is consumed *before* the password is written: a token that fails
 * to consume must not change anything, and a consumed token whose write then
 * fails leaves the old password in place — safe in both orders of failure.
 */
export async function performPasswordReset(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const userId = await consumeToken(token, "password-reset");
  if (!userId) return { ok: false, reason: "invalid-token" };

  const users = await adminUsers();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId), status: "active" },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
      // Every session issued against the old password stops validating.
      $inc: { sessionEpoch: 1 },
    },
  );
  if (!user) return { ok: false, reason: "no-account" };

  await revokeAllSessions(userId);
  // `findOneAndUpdate` defaults to returning the pre-update document, which is
  // exactly what is wanted here: the role has not changed, and reading it back
  // saves the caller a second query to decide where to send them next.
  return { ok: true, userId, email: user.email, role: user.role };
}

export type LoginLinkOutcome =
  | {
      ok: true;
      userId: string;
      email: string;
      role: import("@/lib/server/db/types").AdminRole;
      sessionEpoch: number;
    }
  | { ok: false; reason: "invalid-token" | "no-account" };

/**
 * Redeems a sign-in link. The caller creates the session — this function only
 * proves "whoever holds this fresh token is this active user".
 */
export async function redeemLoginLink(
  token: string,
): Promise<LoginLinkOutcome> {
  const userId = await consumeToken(token, "login-link");
  if (!userId) return { ok: false, reason: "invalid-token" };

  const users = await adminUsers();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId), status: "active" },
    { $set: { lastLoginAt: new Date(), updatedAt: new Date() } },
  );
  if (!user) return { ok: false, reason: "no-account" };

  return {
    ok: true,
    userId,
    email: user.email,
    role: user.role,
    sessionEpoch: user.sessionEpoch,
  };
}
