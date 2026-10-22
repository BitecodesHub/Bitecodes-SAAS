import "server-only";

import crypto from "node:crypto";
import {
  feedback as feedbackCol,
  testimonials as testimonialsCol,
} from "@/lib/server/db/collections";
import type { FeedbackDoc, TestimonialDoc } from "@/lib/server/db/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new feedback record for a customer.
 *
 * Used when queuing survey requests: inserts the record in `requested` status
 * and returns the plaintext token the survey link is built from. The token
 * itself is never stored — only its SHA-256 hash.
 */
export async function createFeedbackRequest(opts: {
  ownerId: string | null;
  email: string | null;
  source: FeedbackDoc["source"];
  surveyKey: string;
}): Promise<{ feedbackId: string; token: string }> {
  const col = await feedbackCol();
  const now = new Date();
  const token = generateToken();
  const tokenHash = sha256Hex(token);

  const doc: Omit<FeedbackDoc, "_id"> = {
    ownerId: opts.ownerId,
    email: opts.email,
    tokenHash,
    source: opts.source,
    surveyKey: opts.surveyKey,
    score: null,
    comment: null,
    testimonialConsent: false,
    status: "requested",
    requestedAt: now,
    respondedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc as FeedbackDoc);

  return { feedbackId: result.insertedId.toHexString(), token };
}

/**
 * Verifies a survey token from a link.
 *
 * Returns the feedback doc when the token matches an existing record, or null
 * when no matching record exists. Callers can then show the survey form.
 */
export async function verifyToken(token: string): Promise<FeedbackDoc | null> {
  if (!token || token.length > 200) return null;

  const col = await feedbackCol();
  const tokenHash = sha256Hex(token);
  const doc = await col.findOne({ tokenHash });

  return doc ?? null;
}

export interface SubmitFeedbackInput {
  token: string;
  /** 0-10 NPS score */
  score: number;
  comment?: string;
  /** True when the customer consents to their comment being used as a testimonial */
  testimonialConsent?: boolean;
  authorName?: string;
  authorRole?: string;
  company?: string;
}

/**
 * Submits an NPS score and optional comment.
 *
 * On success, if the customer gave testimonial consent and wrote a comment,
 * a `TestimonialDoc` is created in `pending` status for admin moderation.
 *
 * Returns `{ ok: true }` on success, or an error string.
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<{ ok: true; feedbackId: string } | { ok: false; error: string }> {
  if (
    typeof input.score !== "number" ||
    input.score < 0 ||
    input.score > 10 ||
    !Number.isInteger(input.score)
  ) {
    return { ok: false, error: "Score must be an integer between 0 and 10." };
  }

  const doc = await verifyToken(input.token);
  if (!doc) {
    return { ok: false, error: "Survey link is invalid or has expired." };
  }

  if (doc.status === "received" || doc.respondedAt !== null) {
    return { ok: false, error: "This survey has already been submitted." };
  }

  const col = await feedbackCol();
  const now = new Date();
  const consent = input.testimonialConsent ?? false;
  const comment = input.comment?.trim() ?? null;

  await col.updateOne(
    { tokenHash: sha256Hex(input.token) },
    {
      $set: {
        score: input.score,
        comment,
        testimonialConsent: consent,
        status: "received",
        respondedAt: now,
        updatedAt: now,
      },
    },
  );

  const feedbackId = doc._id?.toHexString() ?? "";

  // Create a pending testimonial when the customer consented and has a comment.
  if (consent && comment && comment.length >= 10) {
    const consentText =
      "I consent to my feedback being displayed as a testimonial on the Bitecodes website.";
    const testimonialsCollection = await testimonialsCol();

    const testimonial: Omit<TestimonialDoc, "_id"> = {
      feedbackId,
      ownerId: doc.ownerId,
      quote: comment,
      authorName:
        input.authorName?.trim() ?? doc.email?.split("@")[0] ?? "A customer",
      authorRole: input.authorRole?.trim() ?? null,
      company: input.company?.trim() ?? null,
      consentText,
      consentAt: now,
      status: "pending",
      approvedById: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await testimonialsCollection.insertOne(testimonial as TestimonialDoc);
  }

  return { ok: true, feedbackId };
}

/**
 * Checks whether a customer is eligible to receive an NPS survey request.
 *
 * A customer is eligible when:
 * - They have never been surveyed, OR
 * - Their last survey was in a different month from `surveyKey`
 * - AND they have not already responded this month
 */
export async function isEligibleForFeedback(
  ownerId: string,
  surveyKey: string,
): Promise<boolean> {
  const col = await feedbackCol();

  // Check if already has a record for this survey key
  const existing = await col.findOne({
    ownerId,
    surveyKey,
  });

  if (existing) {
    // Already requested or responded this round
    return false;
  }

  // Check if they responded within the last 30 days to avoid spamming
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentResponse = await col.findOne({
    ownerId,
    status: "received",
    respondedAt: { $gte: thirtyDaysAgo },
  });

  return recentResponse === null;
}
