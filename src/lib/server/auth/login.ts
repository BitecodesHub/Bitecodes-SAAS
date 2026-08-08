import "server-only";

import { ObjectId } from "mongodb";
import { adminUsers } from "@/lib/server/db/collections";
import type { AdminUserDoc } from "@/lib/server/db/types";
import { hashPassword, verifyPassword } from "@/lib/server/crypto";
import { normalizeEmail } from "@/lib/email/address";

/**
 * Password authentication for the admin panel.
 *
 * Two defences that matter more than they look:
 *
 * **Uniform work on failure.** When the email does not exist, a dummy hash
 * verification still runs. Without it, "unknown account" returns in
 * microseconds while "wrong password" takes ~100 ms of scrypt, and that gap
 * enumerates valid admin addresses.
 *
 * **Uniform error messages.** Every failure reports the same thing. A distinct
 * "no such user" message leaks the same information the timing defence closes.
 * The one exception is a lockout, which the operator has to be told about or
 * they cannot act on it.
 */

/** Attempts before an account locks. */
const MAX_FAILED_ATTEMPTS = 5;

/** How long a lockout lasts. Long enough to stop guessing, short enough to wait out. */
const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * A pre-computed hash of an unguessable password, used to spend the same scrypt
 * time on a missing account as on a real one. Computed lazily once per process.
 */
let dummyHashPromise: Promise<string> | undefined;

function getDummyHash() {
  dummyHashPromise ??= hashPassword(
    "dummy-password-never-matches-anything-0000",
  );
  return dummyHashPromise;
}

export type LoginFailure =
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterSeconds: number }
  | { ok: false; reason: "disabled" }
  | { ok: false; reason: "unverified"; email: string }
  | { ok: false; reason: "two-factor-required" };

export type LoginResult =
  | {
      ok: true;
      userId: string;
      role: AdminUserDoc["role"];
      sessionEpoch: number;
      name: string;
      email: string;
    }
  | LoginFailure;

export async function authenticateAdmin(
  rawEmail: string,
  password: string,
  totpCode?: string,
  now = new Date(),
): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);
  const users = await adminUsers();
  const user = await users.findOne({ email });

  if (!user) {
    // Spend comparable time so a missing account is indistinguishable.
    await verifyPassword(password, await getDummyHash());
    return { ok: false, reason: "invalid" };
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      ok: false,
      reason: "locked",
      retryAfterSeconds: Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 1000,
      ),
    };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    await recordFailure(user, now);
    return { ok: false, reason: "invalid" };
  }

  // Status is checked only after the password verifies, so a disabled account
  // cannot be identified without its password.
  //
  // `pending` is told apart from `disabled` because the two need opposite
  // things from the person: one has to click a link we already sent them, the
  // other has to talk to us. Both answers are given only to somebody who has
  // just proved they know the password, so neither leaks anything to a stranger.
  if (user.status === "pending") {
    return { ok: false, reason: "unverified", email: user.email };
  }
  if (user.status !== "active") {
    return { ok: false, reason: "disabled" };
  }

  if (user.totpSecret && user.totpEnabledAt) {
    if (!totpCode) return { ok: false, reason: "two-factor-required" };

    const { verifyTotp } = await import("@/lib/server/auth/totp");
    if (!verifyTotp(user.totpSecret, totpCode, now.getTime())) {
      // A wrong second factor counts towards the lockout too, otherwise the
      // six-digit code could be brute-forced against a known-good password.
      await recordFailure(user, now);
      return { ok: false, reason: "invalid" };
    }
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
        updatedAt: now,
      },
    },
  );

  return {
    ok: true,
    userId: user._id!.toHexString(),
    role: user.role,
    sessionEpoch: user.sessionEpoch,
    name: user.name,
    email: user.email,
  };
}

async function recordFailure(user: AdminUserDoc, now: Date) {
  const attempts = user.failedAttempts + 1;
  const users = await adminUsers();

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        failedAttempts: attempts,
        lockedUntil:
          attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + LOCKOUT_MS)
            : user.lockedUntil,
        updatedAt: now,
      },
    },
  );
}

/**
 * Changes a password and invalidates every existing session.
 *
 * Bumping `sessionEpoch` is what makes the invalidation total: sessions store
 * the epoch they were issued under, so all of them stop validating at once —
 * including any an attacker had already stolen, which is the whole reason a user
 * changes their password.
 */
export async function changeAdminPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const users = await adminUsers();
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
      $inc: { sessionEpoch: 1 },
    },
  );

  const { revokeAllSessions } = await import("@/lib/server/auth/session");
  await revokeAllSessions(userId);
}

/** Verifies a password without touching lockout state. For re-auth prompts. */
export async function verifyCurrentPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const users = await adminUsers();
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 1 } },
  );
  if (!user) return false;
  return verifyPassword(password, user.passwordHash);
}

export const LOGIN_LIMITS = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  lockoutMs: LOCKOUT_MS,
} as const;
