import "server-only";

import { buildSubmissionSchema, HONEYPOT_FIELD } from "@/lib/forms/fields";
import { isEmbedOriginAllowed } from "@/lib/server/embed-origin";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { debit } from "@/lib/server/wallet/wallet";
import { recordSubmission } from "@/lib/server/forms/repository";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { sha256Hex } from "@/lib/server/crypto";
import type { FormDoc } from "@/lib/server/db/types";

/**
 * The public form-submission pipeline.
 *
 * Order of checks is deliberate, and each step exists for a reason:
 *
 *  1. **Origin** — the allowlist is the boundary that stops a stranger's site
 *     from posting to someone else's form. Checked server-side, because CORS
 *     alone does not prevent delivery of a simple POST.
 *  2. **Honeypot** — a filled trap field returns *fake success*. Bots must not
 *     learn they were caught, must not consume the owner's credits, and must not
 *     be stored. This runs before metering for exactly that reason.
 *  3. **Validation** — the strict, per-form schema. Unknown keys are rejected,
 *     so the endpoint cannot be used to store arbitrary data.
 *  4. **Rate limits** — per visitor IP and per form, so one embed cannot drain a
 *     credit pack in a burst.
 *  5. **Credit debit** — atomic. Exactly one credit per accepted submission, and
 *     the debit happens *before* persistence so a submission is never stored
 *     unpaid. When the owner is out of credits the submission is refused
 *     outright (metering has to mean something) and the owner is emailed so the
 *     outage is visible rather than silent.
 *  6. **Persist, then notify.**
 */

const CREDITS_PER_SUBMISSION = 1;

export type SubmitOutcome =
  | {
      kind: "ok";
      submissionId: string;
      thankYouMessage: string;
      redirectUrl: string | null;
    }
  /** Honeypot tripped: indistinguishable from success to the caller. */
  | { kind: "ok-silent"; thankYouMessage: string; redirectUrl: string | null }
  | { kind: "origin-denied" }
  | { kind: "invalid"; fieldErrors: Record<string, string[]> }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "out-of-credits" };

export interface SubmitInput {
  form: FormDoc;
  /** Raw submitted body, minus the transport token. Untrusted. */
  payload: Record<string, unknown>;
  origin: string | null;
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
  now?: Date;
}

function ipHashOf(ip: string | null): string | null {
  return ip ? sha256Hex(ip) : null;
}

export async function handleSubmission(
  input: SubmitInput,
): Promise<SubmitOutcome> {
  const { form } = input;
  const thankYouMessage = form.thankYouMessage;
  const redirectUrl = form.redirectUrl;

  // 1. Origin allowlist — fail closed.
  if (!isEmbedOriginAllowed(input.origin, form.allowedDomains)) {
    return { kind: "origin-denied" };
  }

  // 2. Honeypot: fake success, no spend, no storage.
  if (form.honeypotEnabled) {
    const trap = input.payload[HONEYPOT_FIELD];
    if (typeof trap === "string" && trap.trim() !== "") {
      return { kind: "ok-silent", thankYouMessage, redirectUrl };
    }
  }
  // The trap is never data, whether or not it is enabled.
  const { [HONEYPOT_FIELD]: _trap, ...data } = input.payload;
  void _trap;

  // 3. Strict validation against this form's own field definitions.
  const parsed = buildSubmissionSchema(form.fields).safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { kind: "invalid", fieldErrors };
  }

  // 4. Rate limits: per visitor for abuse, per form as a spend ceiling.
  const ipHash = ipHashOf(input.ip);
  const perVisitor = await consumeNamedRateLimit(
    "formSubmit",
    `${form.formId}:${ipHash ?? "unknown"}`,
  );
  if (!perVisitor.allowed) {
    return {
      kind: "rate-limited",
      retryAfterSeconds: perVisitor.retryAfterSeconds,
    };
  }
  const perForm = await consumeNamedRateLimit("formSubmitPerForm", form.formId);
  if (!perForm.allowed) {
    return {
      kind: "rate-limited",
      retryAfterSeconds: perForm.retryAfterSeconds,
    };
  }

  // 5. Pay for it before storing it.
  const spend = await debit({
    ownerId: form.ownerId,
    product: "forms",
    amount: CREDITS_PER_SUBMISSION,
    subjectId: form.formId,
    note: `submission:${form.name}`,
    now: input.now,
  });
  if (!spend.ok) {
    await notifyOutOfCredits(form);
    return { kind: "out-of-credits" };
  }

  // 6. Persist, then notify the owner.
  const submissionId = await recordSubmission({
    ownerId: form.ownerId,
    formId: form.formId,
    data: parsed.data,
    meta: {
      ipHash,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      referrer: input.referrer?.slice(0, 500) ?? null,
      origin: input.origin,
    },
    now: input.now,
  });

  await notifyNewSubmission(form, parsed.data, spend.balanceAfter);

  return { kind: "ok", submissionId, thankYouMessage, redirectUrl };
}

/** Emails the form's notify list. Failures never fail the submission. */
async function notifyNewSubmission(
  form: FormDoc,
  data: Record<string, string | number | boolean>,
  remaining: number,
): Promise<void> {
  if (form.notifyEmails.length === 0) return;

  const lines = Object.entries(data).map(([key, value]) => `${key}: ${value}`);
  const url = `${getSiteUrl()}/admin/forms/${form.formId}`;

  try {
    await Promise.all(
      form.notifyEmails.map((to) =>
        queueEmail({
          to,
          subject: `New submission — ${form.name}`,
          blocks: [
            { type: "p", text: `A new submission arrived on “${form.name}”.` },
            { type: "ul", items: lines },
            { type: "cta", label: "View submissions", url },
            {
              type: "p",
              text: `${remaining} submission credit${remaining === 1 ? "" : "s"} remaining.`,
            },
          ],
          category: "transactional",
          skipApproval: true,
          track: false,
        }),
      ),
    );
  } catch (error) {
    // Losing a notification must never lose the lead, so this stays non-fatal —
    // but it must not be SILENT. A submission that stores correctly, charges a
    // credit, and never tells the owner is indistinguishable from a working form
    // until someone checks the database. Swallowing the reason as well as the
    // error made that undiagnosable: no row, no log, no trace anywhere.
    console.error(
      "[forms] submission notification failed for",
      form.formId,
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }
}

/**
 * Warns the owner that submissions are being turned away. Rate-limited to one
 * notice per form per day so a busy form cannot spam the inbox it is protecting.
 */
async function notifyOutOfCredits(form: FormDoc): Promise<void> {
  if (form.notifyEmails.length === 0) return;

  const throttle = await consumeNamedRateLimit(
    "formCreditsWarning",
    form.formId,
  );
  if (!throttle.allowed) return;

  const url = `${getSiteUrl()}/admin/forms`;
  try {
    await Promise.all(
      form.notifyEmails.map((to) =>
        queueEmail({
          to,
          subject: `Action needed — “${form.name}” is out of submission credits`,
          blocks: [
            {
              type: "p",
              text: `Your form “${form.name}” has run out of submission credits, so new submissions are being declined. Visitors see a short “temporarily unavailable” message.`,
            },
            { type: "cta", label: "Top up credits", url },
          ],
          category: "transactional",
          skipApproval: true,
          track: false,
        }),
      ),
    );
  } catch {
    // Best effort.
  }
}
