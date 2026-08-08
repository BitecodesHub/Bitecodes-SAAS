import "server-only";

import { ObjectId } from "mongodb";
import { adminTokens, adminUsers } from "@/lib/server/db/collections";
import type { AdminUserDoc, WalletProduct } from "@/lib/server/db/types";
import {
  hashPassword,
  randomToken,
  sha256Hex,
  validatePasswordStrength,
} from "@/lib/server/crypto";
import { normalizeEmail, isDeliverableEmail } from "@/lib/email/address";
import { credit } from "@/lib/server/wallet/wallet";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { siteConfig } from "@/lib/site";

/**
 * Self-serve account creation.
 *
 * Three decisions here are worth more than the code that implements them.
 *
 * **Sign-up does not reveal whether an address already has an account.** The
 * obvious implementation answers "that email is taken", which turns the form
 * into an oracle: anyone can test a list of addresses and learn which of them
 * are customers. So both paths answer identically. A brand-new address gets a
 * verification link; an address that already has an account gets an email
 * saying so, with a link to sign in or reset. The person who owns the inbox
 * always learns the truth. The person filling in the form learns nothing.
 *
 * **Nothing of value is created until the address is proven.** The account is
 * written in `pending` status, which `readAdminSession` refuses, and the
 * starter credits are granted by `verifyEmail`, not here. A script that posts a
 * thousand sign-ups therefore produces a thousand rows that cannot sign in, own
 * nothing, and cost nothing — rather than a thousand funded wallets.
 *
 * **The email is the slow part, and it must not be the failing part.** A queued
 * message that cannot be handed to SMTP still leaves a usable account behind,
 * recoverable with "resend my link", so a mail outage delays sign-ups instead of
 * losing them.
 */

/** How long a verification link stays good. Long enough to survive a spam folder. */
const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * What a verified account starts with, per product.
 *
 * A free allowance rather than a free trial with an expiry: credits that vanish
 * on a date punish somebody who signed up before a busy fortnight, and the whole
 * point of the pricing is that credits do not expire. Enough of each to build the
 * thing, embed it, and watch it work — not enough to run a business on.
 *
 * Placeholder amounts, exactly like `PACKS_ARE_PLACEHOLDER_PRICING`. This is the
 * one place to change them.
 */
export const SIGNUP_BONUS: Record<WalletProduct, number> = {
  chatbot: 100,
  forms: 25,
  bookings: 10,
  email: 25,
};

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  company?: string;
}

export type SignupResult =
  | { ok: true }
  | { ok: false; field: "name" | "email" | "password"; error: string };

/**
 * Creates a pending customer account and emails a verification link.
 *
 * Returns `{ ok: true }` for a genuinely new account AND for an address that
 * already exists. Callers must render the same "check your inbox" screen for
 * both — see the note above. Only malformed input is reported as a field error,
 * because that is something the person at the keyboard already knows.
 */
export async function signUpCustomer(
  input: SignupInput,
): Promise<SignupResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, field: "name", error: "Tell us what to call you." };
  }
  if (name.length > 80) {
    return { ok: false, field: "name", error: "Use at most 80 characters." };
  }

  const email = normalizeEmail(input.email);
  if (!isDeliverableEmail(email)) {
    return {
      ok: false,
      field: "email",
      error: "That does not look like an address we can deliver to.",
    };
  }

  const passwordProblems = validatePasswordStrength(input.password);
  if (passwordProblems.length > 0) {
    return { ok: false, field: "password", error: passwordProblems.join(" ") };
  }

  const users = await adminUsers();
  const existing = await users.findOne(
    { email },
    { projection: { _id: 1, name: 1, status: 1 } },
  );

  if (existing) {
    await emailExistingAccountNotice(email, existing.name);
    return { ok: true };
  }

  const now = new Date();
  const document: Omit<AdminUserDoc, "_id"> = {
    email,
    name,
    company: input.company?.trim().slice(0, 120) || null,
    role: "customer",
    passwordHash: await hashPassword(input.password),
    status: "pending",
    emailVerifiedAt: null,
    totpSecret: null,
    totpEnabledAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    sessionEpoch: 1,
    createdAt: now,
    updatedAt: now,
  };

  let userId: string;
  try {
    const inserted = await users.insertOne(document as AdminUserDoc);
    userId = inserted.insertedId.toHexString();
  } catch (error) {
    // The unique index on `email` is the real guard against two simultaneous
    // sign-ups for one address; the `findOne` above only saves the common case
    // a round trip. Losing that race is not an error the visitor caused, and
    // must produce the same answer as the existing-account branch.
    if ((error as { code?: number }).code === 11000) {
      await emailExistingAccountNotice(email, name);
      return { ok: true };
    }
    throw error;
  }

  await sendVerificationEmail(userId, email, name);
  return { ok: true };
}

/** Issues a fresh verification token and emails the link. */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
): Promise<void> {
  const token = randomToken(32);
  const now = new Date();

  const tokens = await adminTokens();
  await tokens.insertOne({
    tokenHash: sha256Hex(token),
    userId,
    purpose: "verify-email",
    createdAt: now,
    expiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
    usedAt: null,
  });

  const url = `${getSiteUrl()}/verify/${token}`;

  await queueEmail({
    to: email,
    toName: name,
    subject: `Confirm your ${siteConfig.name} account`,
    blocks: [
      {
        type: "p",
        text: `Welcome to ${siteConfig.name}. Confirm this address and your account is ready to use, with free credits already on it.`,
      },
      { type: "cta", label: "Confirm my email", url },
      {
        type: "p",
        text: "The link works once and expires in 48 hours. If you did not create an account, ignore this email — nothing has been set up in your name.",
      },
    ],
    category: "transactional",
    skipApproval: true,
    track: false,
  });
}

/**
 * Tells the owner of an existing address that somebody tried to sign up with it.
 *
 * This is what makes the non-enumerating sign-up honest rather than merely
 * silent: if it really was them, they get the sign-in link they were after; if
 * it was not, they learn that somebody is probing their address, which is worth
 * knowing.
 */
async function emailExistingAccountNotice(
  email: string,
  name: string,
): Promise<void> {
  await queueEmail({
    to: email,
    toName: name,
    subject: `You already have a ${siteConfig.name} account`,
    blocks: [
      {
        type: "p",
        text: `Somebody just tried to create a ${siteConfig.name} account with this address. There is already one here, so nothing new has been set up.`,
      },
      { type: "cta", label: "Sign in", url: `${getSiteUrl()}/login` },
      {
        type: "p",
        text: `If that was you and you have forgotten the password, reset it at ${getSiteUrl()}/forgot. If it was not you, no action is needed — whoever it was could not see that this address is registered.`,
      },
    ],
    category: "transactional",
    skipApproval: true,
    track: false,
  });
}

export type VerifyOutcome =
  | { ok: true; userId: string; email: string; name: string; granted: boolean }
  | { ok: false; reason: "invalid-token" | "no-account" };

/**
 * Redeems a verification link: activates the account and funds the wallets.
 *
 * The activation is a conditional update on `status: "pending"`, so a second
 * click cannot grant a second helping of credits even if two requests arrive at
 * once — one of them matches nothing. `granted` reports which one did the work,
 * so the page can say "here are your free credits" only when they were actually
 * added.
 */
export async function verifyEmail(token: string): Promise<VerifyOutcome> {
  const { consumeToken } = await import("@/lib/server/auth/recovery");
  const userId = await consumeToken(token, "verify-email");
  if (!userId) return { ok: false, reason: "invalid-token" };

  const users = await adminUsers();
  const now = new Date();

  const activated = await users.findOneAndUpdate(
    { _id: new ObjectId(userId), status: "pending" },
    { $set: { status: "active", emailVerifiedAt: now, updatedAt: now } },
  );

  if (activated) {
    await grantSignupBonus(userId);
    return {
      ok: true,
      userId,
      email: activated.email,
      name: activated.name,
      granted: true,
    };
  }

  // The token was valid but the account was not pending. Already-verified is
  // the ordinary case — someone clicked an older link — and reads as success.
  const user = await users.findOne(
    { _id: new ObjectId(userId), status: "active" },
    { projection: { email: 1, name: 1 } },
  );
  if (!user) return { ok: false, reason: "no-account" };

  return {
    ok: true,
    userId,
    email: user.email,
    name: user.name,
    granted: false,
  };
}

/** Credits every product's starter allowance. Journalled as `bonus`. */
async function grantSignupBonus(ownerId: string): Promise<void> {
  for (const [product, amount] of Object.entries(SIGNUP_BONUS)) {
    if (amount <= 0) continue;
    await credit({
      ownerId,
      product: product as WalletProduct,
      amount,
      kind: "bonus",
      note: "welcome credits",
    });
  }
}

/**
 * Re-sends a verification link, if the address has a pending account.
 *
 * Silent either way, for the same reason sign-up is: answering "no such pending
 * account" would identify verified customers.
 */
export async function resendVerification(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const users = await adminUsers();
  const user = await users.findOne(
    { email, status: "pending" },
    { projection: { _id: 1, email: 1, name: 1 } },
  );
  if (!user?._id) return;

  await sendVerificationEmail(user._id.toHexString(), user.email, user.name);
}
