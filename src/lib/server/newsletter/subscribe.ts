import "server-only";

import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { newsletterSubscribers } from "@/lib/server/db/collections";
import type { NewsletterSubscriberDoc } from "@/lib/server/db/types";
import { createSignedToken, verifySignedToken } from "@/lib/server/tokens";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";

/**
 * Newsletter sign-up — double opt-in.
 *
 * Flow:
 *  1. Caller submits `{ email, source, consent: true }`.
 *  2. We persist the subscriber as `pending` and queue a transactional email
 *     carrying a signed HMAC token.
 *  3. The subscriber clicks the link → GET /api/newsletter/confirm?token=...
 *  4. `confirmSubscriber()` verifies the token and flips the row to
 *     `subscribed`.
 *
 * Status vocabulary (aligned with the API and page contracts):
 *  - `pending`     — stored, confirmation email queued.
 *  - `already`     — already subscribed (or pending, re-send gate).
 *  - `confirmed`   — (returned only by `confirmSubscriber`).
 *  - `unavailable` — email system threw; treat as a transient error.
 */

export type SubscribeStatus =
  | "pending"
  | "already"
  | "confirmed"
  | "unavailable";

export interface SubscribeResult {
  status: SubscribeStatus;
}

export interface SubscribeInput {
  email: string;
  /** Where the form appeared, e.g. "blog-post" or "footer". */
  source: string;
  consent: boolean;
  consentText?: string | null;
}

/** Token TTL: 72 h gives subscribers a full working day on both sides of send. */
const CONFIRM_TTL_SECONDS = 72 * 60 * 60;

/** Normalises an email for storage and comparison. */
function normalise(email: string): string {
  return email.toLowerCase().trim();
}

/** Stable, non-reversible key for a token — keeps the email out of the URL. */
function subscriberKey(email: string): string {
  return createHash("sha256")
    .update(normalise(email))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Subscribes an email address.  Returns `already` when the subscriber already
 * exists and is either `subscribed` or `pending` (a duplicate click should not
 * reveal status detail, but we still re-queue the confirmation email on
 * `pending` so genuine lost emails can be recovered by re-submitting).
 */
export async function subscribeToNewsletter(
  input: SubscribeInput,
): Promise<SubscribeResult> {
  if (!input.consent) {
    // Callers must enforce consent before calling here; this is a backstop.
    return { status: "unavailable" };
  }

  const email = normalise(input.email);

  let collection;
  try {
    collection = await newsletterSubscribers();
  } catch {
    return { status: "unavailable" };
  }

  const existing = await collection.findOne({ email });

  if (existing?.status === "subscribed") {
    return { status: "already" };
  }

  const now = new Date();

  if (!existing) {
    try {
      await collection.insertOne({
        _id: new ObjectId(),
        email,
        name: null,
        status: "pending",
        source: input.source,
        confirmedAt: null,
        unsubscribedAt: null,
        createdAt: now,
        updatedAt: now,
      } as NewsletterSubscriberDoc);
    } catch {
      return { status: "unavailable" };
    }
  }
  // If existing.status === "pending" we still queue a new confirmation email
  // below (the subscriber may have lost the first one).

  // Queue the confirmation email.  Any failure is caught so a transient mail
  // error does not prevent the subscriber from being stored.
  try {
    const token = createSignedToken({
      purpose: "unsubscribe", // reused — purpose = link that works without login
      data: {
        action: "confirm-newsletter",
        k: subscriberKey(email),
        email, // stored in payload, verified on confirm
      },
      ttlSeconds: CONFIRM_TTL_SECONDS,
    });

    const confirmUrl = `${getSiteUrl()}/api/newsletter/confirm?token=${token}`;

    await queueEmail({
      to: email,
      subject: "Confirm your subscription to Bitecodes",
      blocks: [
        {
          type: "p",
          text: "Thanks for signing up. Click the button below to confirm your email address and start receiving our newsletter.",
        },
        {
          type: "p",
          text: `Confirm: ${confirmUrl}`,
        },
        {
          type: "p",
          text: "If you did not sign up, you can safely ignore this email.",
        },
      ],
      category: "transactional",
      templateKey: "newsletter.confirm",
    });
  } catch {
    // The subscriber is already stored. The confirmation email failing is
    // recoverable (they can re-submit). We do NOT return `unavailable` here
    // because the subscription row exists.
    return { status: "pending" };
  }

  return { status: "pending" };
}

/**
 * Verifies a confirmation token from `GET /api/newsletter/confirm?token=…`
 * and marks the subscriber as `subscribed`.
 *
 * Returns `confirmed` on success, `already` when already subscribed, and
 * `unavailable` on a token or database problem.
 */
export async function confirmSubscriber(
  token: string | null | undefined,
): Promise<SubscribeResult> {
  if (!token) return { status: "unavailable" };

  const verification = verifySignedToken<{
    action: string;
    email: string;
    k: string;
  }>(token, "unsubscribe");

  if (!verification.ok) return { status: "unavailable" };
  if (verification.data.action !== "confirm-newsletter")
    return { status: "unavailable" };

  const email = String(verification.data.email ?? "")
    .toLowerCase()
    .trim();
  if (!email) return { status: "unavailable" };

  // Double-check the stable key matches to prevent token-stuffing across
  // accounts.
  const expectedKey = subscriberKey(email);
  if (verification.data.k !== expectedKey) return { status: "unavailable" };

  let collection;
  try {
    collection = await newsletterSubscribers();
  } catch {
    return { status: "unavailable" };
  }

  const existing = await collection.findOne({ email });
  if (!existing) return { status: "unavailable" };
  if (existing.status === "subscribed") return { status: "already" };

  await collection.updateOne(
    { email },
    {
      $set: {
        status: "subscribed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return { status: "confirmed" };
}
