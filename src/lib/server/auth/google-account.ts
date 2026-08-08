import "server-only";

import { adminUsers } from "@/lib/server/db/collections";
import type { AdminUserDoc } from "@/lib/server/db/types";
import { hashPassword, randomToken } from "@/lib/server/crypto";
import { normalizeEmail } from "@/lib/email/address";
import { isCustomerRole } from "@/lib/server/auth/roles";
import { revokeAllSessions } from "@/lib/server/auth/session";
import { grantSignupBonus } from "@/lib/server/auth/signup";
import type { GoogleIdentity } from "@/lib/server/auth/google-oauth";

/**
 * Turning a Google identity into an account.
 *
 * This file is the whole of the linking policy, and the policy is where social
 * sign-in goes wrong. Three rules, each guarding a different way in:
 *
 * **An unverified Google address links to nothing.** Some Google identities —
 * Workspace accounts on domains that never completed verification, chiefly —
 * assert an address the holder has not proven. Linking on address alone would
 * mean: register a Google identity claiming somebody's address, press the
 * button, take over their account. `email_verified` must be true before an
 * address is allowed to match anything.
 *
 * **Google signs in customers, never staff.** A staff account can carry TOTP,
 * and this route has no second factor — so allowing it would let a compromised
 * Google account walk past the owner's authenticator and into the admin panel,
 * which holds every customer's records and the provider API keys. Staff keep
 * the password path. This is refused loudly rather than silently, so a member of
 * staff who tries is told where to go instead of being told their details are
 * wrong.
 *
 * **The subject is the identity; the address is a label.** Lookup is by `sub`
 * first, because Google's own documentation says the address on an account can
 * change and `sub` cannot. Matching only on address would quietly hand an
 * account to whoever inherited a recycled Workspace address.
 */

export type GoogleSignInOutcome =
  | {
      ok: true;
      userId: string;
      email: string;
      role: AdminUserDoc["role"];
      sessionEpoch: number;
      /** True when this call created the account, for the audit trail. */
      created: boolean;
    }
  | {
      ok: false;
      reason:
        | "unverified-email"
        | "staff-account"
        | "disabled"
        | "already-linked";
    };

export async function signInWithGoogle(
  identity: GoogleIdentity,
): Promise<GoogleSignInOutcome> {
  const users = await adminUsers();
  const email = normalizeEmail(identity.email);
  const now = new Date();

  // By subject first. An account already linked is found even if the person has
  // since changed the address on their Google account.
  const linked = await users.findOne({ googleSub: identity.subject });
  if (linked) return activate(linked, { email, now, created: false });

  if (!identity.emailVerified) {
    return { ok: false, reason: "unverified-email" };
  }

  const existing = await users.findOne({ email });
  if (existing) {
    if (!isCustomerRole(existing.role)) {
      return { ok: false, reason: "staff-account" };
    }
    // Link, but only onto an account with no other Google identity attached.
    // The condition is in the query so two simultaneous attempts cannot both
    // win and leave the second overwriting the first.
    const claimed = await users.findOneAndUpdate(
      {
        _id: existing._id,
        $or: [{ googleSub: { $exists: false } }, { googleSub: null }],
      },
      { $set: { googleSub: identity.subject, updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!claimed) {
      // A different Google identity already owns this account. Refusing is the
      // only safe answer: overwriting would transfer the account to whoever
      // pressed the button most recently.
      return { ok: false, reason: "already-linked" };
    }
    return activate(claimed, { email, now, created: false });
  }

  return createFromGoogle(identity, email, now);
}

/**
 * Brings an existing account to a signable-in state and reports its session
 * details.
 *
 * A `pending` customer becomes active here. That is the point: the account was
 * pending because the address was unproven, and Google has just proven it — so
 * making them go and find the confirmation email as well would be asking for a
 * second proof of the same fact. The welcome credits are granted on that
 * transition, exactly as `verifyEmail` does, and the conditional update makes
 * sure they are granted once.
 *
 * **The password set on a pending account does not survive that transition.**
 * This closes a pre-hijack takeover, and it is the least obvious rule in this
 * file:
 *
 *   1. Sign-up is deliberately non-enumerating, so anyone may register
 *      `victim@example.com` with a password of their choosing. The row is
 *      `pending`, so that password does not work — yet.
 *   2. The victim, who genuinely owns the address, later presses "Continue with
 *      Google" for reasons of their own. Their Google subject is attached to
 *      the row that was waiting for them, and it becomes active.
 *   3. The password from step 1 now works, because the only thing that had been
 *      blocking it was the `pending` status.
 *
 * Google proved the *address*. It proved nothing about a password chosen by
 * somebody who never had to. So the hash is replaced with one nobody knows and
 * every existing session is revoked; the holder sets a real password through
 * "forgot password", which is safe precisely because the address is now proven.
 *
 * A password on an account that had ALREADY verified its own address is left
 * alone — there, the person who set it is the person who proved the address, and
 * taking it away would punish somebody for adding Google to their own account.
 */
async function activate(
  user: AdminUserDoc,
  context: { email: string; now: Date; created: boolean },
): Promise<GoogleSignInOutcome> {
  const users = await adminUsers();

  if (!isCustomerRole(user.role)) {
    return { ok: false, reason: "staff-account" };
  }
  if (user.status === "disabled") {
    return { ok: false, reason: "disabled" };
  }

  if (user.status === "pending") {
    const activated = await users.findOneAndUpdate(
      { _id: user._id, status: "pending" },
      {
        $set: {
          status: "active",
          emailVerifiedAt: context.now,
          // 48 random bytes, hashed and thrown away. No input verifies against
          // it, so the planted password stops working at this instant.
          passwordHash: await hashPassword(randomToken(48)),
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: context.now,
        },
        // Invalidates every session ever issued under the old epoch, including
        // any the pre-registrant had already obtained.
        $inc: { sessionEpoch: 1 },
      },
      { returnDocument: "after" },
    );
    if (activated) {
      await revokeAllSessions(user._id!.toHexString());
      await grantSignupBonus(user._id!.toHexString());
      // Read back with the incremented epoch, so the session issued below is
      // created under the new one rather than being invalid on arrival.
      user = activated;
    }
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        lastLoginAt: context.now,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: context.now,
      },
    },
  );

  return {
    ok: true,
    userId: user._id!.toHexString(),
    email: user.email,
    role: user.role,
    sessionEpoch: user.sessionEpoch,
    created: context.created,
  };
}

async function createFromGoogle(
  identity: GoogleIdentity,
  email: string,
  now: Date,
): Promise<GoogleSignInOutcome> {
  const users = await adminUsers();

  const document: Omit<AdminUserDoc, "_id"> = {
    email,
    name: identity.name?.trim().slice(0, 80) || email.split("@")[0]!,
    company: null,
    role: "customer",
    /*
      An unusable password, not an empty one.

      `passwordHash` is required, and leaving it blank or fixed would make every
      Google-created account share a hash — which is a password, once somebody
      works out what produces it. This hashes 48 random bytes that are then
      discarded, so no input verifies against it and password sign-in simply
      cannot succeed. "Forgot password" is how such an account sets one, and it
      works because the address is already proven.
    */
    passwordHash: await hashPassword(randomToken(48)),
    status: "active",
    emailVerifiedAt: now,
    googleSub: identity.subject,
    totpSecret: null,
    totpEnabledAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now,
    sessionEpoch: 1,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const inserted = await users.insertOne(document as AdminUserDoc);
    const userId = inserted.insertedId.toHexString();
    await grantSignupBonus(userId);
    return {
      ok: true,
      userId,
      email,
      role: "customer",
      sessionEpoch: 1,
      created: true,
    };
  } catch (error) {
    // Two simultaneous first-time sign-ins for one address: the unique index on
    // `email` decides, and the loser retries the whole resolution, which now
    // finds the winner's account.
    if ((error as { code?: number }).code === 11000) {
      return signInWithGoogle(identity);
    }
    throw error;
  }
}
