import "server-only";

import type { EmailBlock } from "@/lib/email/template";
import {
  isDeliverableEmail,
  isNeverContactAddress,
  normalizeEmail,
} from "@/lib/email/address";
import { evaluateOutreachGate } from "@/lib/email/compliance";
import { isSuppressed } from "@/lib/server/email/suppression";
import { queueEmail } from "@/lib/server/email/send";
import { notifyLowBalance } from "@/lib/server/email/notify";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { getSettingsFresh } from "@/lib/server/settings";
import { credit, debit, getBalance } from "@/lib/server/wallet/wallet";
import { siteConfig } from "@/lib/site";

/**
 * The metered customer send — the core behind `POST /api/v1/email/send`.
 *
 * ## What this is for
 *
 * A customer's own application sending **transactional** mail: a password
 * reset, an order confirmation, a "your report is ready" notice. One recipient
 * who did a specific thing, and a message about that thing.
 *
 * ## What this is NOT for
 *
 * **Bulk email and cold email.** Newsletters, campaigns, announcements to a
 * list, anything to an address that did not ask for it. Not "discouraged" —
 * structurally prevented, and the bounds below are the enforcement:
 *
 *  - the sender is always the platform's own verified From address; there is no
 *    field for a customer-supplied sender, because a customer-controlled From
 *    on a shared sending domain is how a shared domain gets blocklisted;
 *  - at most {@link MAX_RECIPIENTS_PER_REQUEST} recipients per request, each
 *    getting its own message — no BCC, no list upload;
 *  - a hard per-key daily cap of {@link DAILY_RECIPIENT_CAP} recipients, which
 *    is an ordinary transactional volume and a useless campaign size;
 *  - the platform suppression list is honoured, so an unsubscribe recorded
 *    anywhere blocks a send from everywhere;
 *  - the compliance gate's absolute blocks apply (undeliverable, never-contact,
 *    suppressed);
 *  - no open or click tracking, and no unsubscribe link — because there is
 *    nothing to unsubscribe *from*. A message that needs an unsubscribe link is
 *    by definition marketing, and marketing does not belong on this endpoint.
 *
 * Anything ambiguous is refused rather than guessed at. That is the whole
 * design: this endpoint is deliberately a poor tool for sending mail people did
 * not ask for.
 *
 * ## Metering
 *
 * One `email` wallet credit per recipient. The balance is checked before any
 * work, debited once the recipient list is final, and refunded for any recipient
 * whose message the pipeline then refused to queue — so a customer is never
 * charged for a message that did not exist.
 */

/** Recipients one request may address. A list this short is not a campaign. */
export const MAX_RECIPIENTS_PER_REQUEST = 10;

/** Recipients one API key may reach per 24 hours. */
export const DAILY_RECIPIENT_CAP = 200;

/** Requests one API key may make per minute. */
const BURST_MAX_REQUESTS = 20;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const MAX_SUBJECT_CHARS = 200;
export const MAX_BODY_CHARS = 5_000;
const MAX_PARAGRAPHS = 40;

/** One credit per recipient, everywhere. */
export const CREDITS_PER_RECIPIENT = 1;

export interface CustomerSendInput {
  ownerId: string;
  /**
   * Stable identity for the API key, used for the per-key caps.
   *
   * The route passes the key's SHA-256 hash — the same value the database
   * stores — so the counter follows the key rather than the account, and the
   * secret itself never reaches the rate limiter.
   */
  keyId: string;
  to: string[];
  subject: string;
  /** Plain text. Blank lines separate paragraphs; no HTML is accepted. */
  body: string;
  /** An optional single call-to-action button. */
  action?: { label: string; url: string } | null;
}

export type SendRefusalCode =
  | "validation"
  | "rate_limited"
  | "daily_cap"
  | "insufficient_credits"
  | "no_valid_recipients";

export interface AcceptedRecipient {
  email: string;
  messageId: string;
}

export interface RejectedRecipient {
  email: string;
  /** Mirrors the pipeline's own skip reasons wherever one applies. */
  reason: string;
}

export type CustomerSendResult =
  | {
      ok: true;
      accepted: AcceptedRecipient[];
      rejected: RejectedRecipient[];
      /** Credits actually spent — one per accepted recipient. */
      charged: number;
      balanceAfter: number;
    }
  | {
      ok: false;
      code: SendRefusalCode;
      message: string;
      /** Present for `rate_limited` and `daily_cap`. */
      retryAfterSeconds?: number;
      rejected?: RejectedRecipient[];
    };

/**
 * Validates, meters, and queues one customer send.
 *
 * The order is the same as every other paid path in this codebase: identity and
 * shape first, then the abuse counters, then screening each recipient, then
 * money, then work. Nothing is queued until the credits for it are spent.
 */
export async function sendCustomerEmail(
  input: CustomerSendInput,
): Promise<CustomerSendResult> {
  // ---- 1. Shape -----------------------------------------------------------
  const subject = input.subject?.trim() ?? "";
  const body = input.body?.trim() ?? "";

  if (subject.length < 1 || subject.length > MAX_SUBJECT_CHARS) {
    return refuse(
      "validation",
      `Subject must be 1–${MAX_SUBJECT_CHARS} characters.`,
    );
  }
  if (body.length < 1 || body.length > MAX_BODY_CHARS) {
    return refuse("validation", `Body must be 1–${MAX_BODY_CHARS} characters.`);
  }
  // `{{ name }}` is the platform's own template syntax. A body containing it
  // would be rendered as a template with no variables, and the send pipeline
  // would refuse it as an incomplete template *after* the credit was spent.
  // Refusing here, plainly, beats charging for a confusing failure.
  if (/\{\{\s*[a-zA-Z]/.test(body) || /\{\{\s*[a-zA-Z]/.test(subject)) {
    return refuse(
      "validation",
      "Remove {{ }} placeholders — this endpoint does not fill template variables. Send the finished text.",
    );
  }
  if (input.action) {
    const label = input.action.label?.trim() ?? "";
    const url = input.action.url?.trim() ?? "";
    if (label.length < 1 || label.length > 60) {
      return refuse("validation", "action.label must be 1–60 characters.");
    }
    if (!isHttpUrl(url)) {
      return refuse("validation", "action.url must be an http(s) URL.");
    }
  }

  const requested = Array.isArray(input.to) ? input.to : [];
  if (requested.length < 1) {
    return refuse("validation", "At least one recipient is required.");
  }
  if (requested.length > MAX_RECIPIENTS_PER_REQUEST) {
    return refuse(
      "validation",
      `At most ${MAX_RECIPIENTS_PER_REQUEST} recipients per request. This endpoint is for transactional mail, not bulk sending.`,
    );
  }

  // De-duplicated before anything is counted or charged: the same address twice
  // in one payload is one message, not two credits.
  const unique = [
    ...new Set(requested.map((value) => normalizeEmail(String(value)))),
  ];

  // ---- 2. Abuse counters, per key ----------------------------------------
  const burst = await consumeRateLimit({
    bucket: "email-send-burst",
    key: input.keyId,
    max: BURST_MAX_REQUESTS,
    windowMs: MINUTE_MS,
  });
  if (!burst.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: `Too many requests. Try again in ${burst.retryAfterSeconds} seconds.`,
      retryAfterSeconds: burst.retryAfterSeconds,
    };
  }

  // The daily cap counts *recipients*, not requests, because a request is a
  // meaningless unit when one of them can carry ten addresses. The limiter
  // counts by one, so the day's budget is consumed one recipient at a time and
  // the whole request is refused if the last one does not fit — a partial send
  // against a cap is the kind of surprise that gets discovered in a support
  // ticket rather than in a log.
  let dailyDenial: { retryAfterSeconds: number } | null = null;
  for (let index = 0; index < unique.length; index += 1) {
    const daily = await consumeRateLimit({
      bucket: "email-send-daily",
      key: input.keyId,
      max: DAILY_RECIPIENT_CAP,
      windowMs: DAY_MS,
    });
    if (!daily.allowed) {
      dailyDenial = { retryAfterSeconds: daily.retryAfterSeconds };
      break;
    }
  }
  if (dailyDenial) {
    return {
      ok: false,
      code: "daily_cap",
      message: `This API key has reached its daily limit of ${DAILY_RECIPIENT_CAP} recipients. The limit exists because this endpoint is for transactional mail; bulk sending is not supported.`,
      retryAfterSeconds: dailyDenial.retryAfterSeconds,
    };
  }

  // ---- 3. Screen every recipient -----------------------------------------
  const rejected: RejectedRecipient[] = [];
  const eligible: string[] = [];

  for (const email of unique) {
    const deliverable = isDeliverableEmail(email);
    const neverContact = isNeverContactAddress(email);
    // Suppression is a direct indexed read that fails closed, so a database
    // problem blocks the send rather than emailing somebody who opted out.
    const suppressed = deliverable ? await isSuppressed(email) : false;

    // The platform's own gate, with the commercial-only inputs neutralised:
    // this is transactional mail, so the postal-address, unsubscribe, consent-
    // region, and daily-outreach-cap rules do not apply to it — but the three
    // absolute blocks (undeliverable, never-contact, suppressed) do, and they
    // are exactly what this call is here to enforce. Re-implementing those
    // three checks locally is how the two paths would eventually disagree.
    const gate = evaluateOutreachGate({
      email,
      countryCode: null,
      suppressed,
      deliverable,
      neverContact,
      domainSentToday: 0,
      globalSentToday: 0,
      perDomainDailyCap: Number.MAX_SAFE_INTEGER,
      globalDailyCap: Number.MAX_SAFE_INTEGER,
      blockConsentRequiredRegions: false,
      hasPostalAddress: true,
      hasUnsubscribeUrl: true,
      missingVariables: [],
    });

    if (!gate.allowed) {
      rejected.push({ email, reason: gate.reason ?? "blocked" });
      continue;
    }
    eligible.push(email);
  }

  if (eligible.length === 0) {
    return {
      ok: false,
      code: "no_valid_recipients",
      message:
        "No recipient could be accepted. Addresses must be deliverable, must not be automated mailboxes, and must not be on the suppression list.",
      rejected,
    };
  }

  // ---- 4. Money -----------------------------------------------------------
  const cost = eligible.length * CREDITS_PER_RECIPIENT;
  const balance = await getBalance(input.ownerId, "email");
  if (balance < cost) {
    // A refusal is the last moment this is still recoverable, so it is worth an
    // email. `notifyLowBalance` throttles to one per day, so a client retrying
    // in a loop cannot turn this into a flood.
    await warnIfLow(input.ownerId, balance);
    return {
      ok: false,
      code: "insufficient_credits",
      message: `This send needs ${cost} email credit${cost === 1 ? "" : "s"} and the balance is ${balance}.`,
      rejected,
    };
  }

  const spend = await debit({
    ownerId: input.ownerId,
    product: "email",
    amount: cost,
    subjectId: input.keyId.slice(0, 12),
    note: `api-send:${eligible.length}`,
  });
  if (!spend.ok) {
    // Lost a race with a concurrent send against the same wallet. The
    // conditional `$inc` is what makes that safe: exactly one of them wins.
    return {
      ok: false,
      code: "insufficient_credits",
      message: `This send needs ${cost} email credit${cost === 1 ? "" : "s"} and the balance is ${spend.balance}.`,
      rejected,
    };
  }

  // ---- 5. Queue -----------------------------------------------------------
  const blocks = buildBlocks(body, input.action ?? null);
  let refundable = 0;
  const accepted: AcceptedRecipient[] = [];

  for (const email of eligible) {
    try {
      const queued = await queueEmail({
        to: email,
        subject,
        blocks,
        // Transactional: sent from the platform's verified address, exempt from
        // the outreach approval queue, and never tracked.
        category: "transactional",
        skipApproval: true,
        track: false,
        footerNote: FOOTER_NOTE,
      });

      if (queued.status === "queued") {
        accepted.push({ email, messageId: queued.messageId });
      } else {
        // The pipeline refused it after all (it re-checks deliverability and
        // never-contact independently). No message will be sent, so the credit
        // goes back.
        refundable += CREDITS_PER_RECIPIENT;
        rejected.push({ email, reason: queued.skipReason ?? queued.status });
      }
    } catch (error) {
      refundable += CREDITS_PER_RECIPIENT;
      rejected.push({ email, reason: "queue-failed" });
      console.error(
        "[email-api] failed to queue message for a recipient:",
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
    }
  }

  let balanceAfter = spend.balanceAfter;
  if (refundable > 0) {
    // A refund is a ledger row of its own rather than a reversal of the debit:
    // the journal is append-only, and "charged then refunded" is the honest
    // description of what happened.
    balanceAfter = await credit({
      ownerId: input.ownerId,
      product: "email",
      amount: refundable,
      kind: "refund",
      subjectId: input.keyId.slice(0, 12),
      note: "api-send:not-queued",
    }).catch(() => spend.balanceAfter);
  }

  await warnIfLow(input.ownerId, balanceAfter);

  return {
    ok: true,
    accepted,
    rejected,
    charged: cost - refundable,
    balanceAfter,
  };
}

/**
 * Fires the low-balance notification when the wallet drops to the configured
 * threshold.
 *
 * Best effort in every sense: a settings read or a queue failure here must not
 * turn a delivered send into an error, and the notification itself is throttled
 * to one per owner per product per day.
 */
async function warnIfLow(ownerId: string, balance: number): Promise<void> {
  try {
    const settings = await getSettingsFresh();
    if (balance > settings.notifications.lowBalance.threshold) return;
    await notifyLowBalance({ ownerId, product: "email", balance });
  } catch (error) {
    console.error(
      "[email-api] low-balance warning failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }
}

/**
 * Identifies the platform in the footer of every message.
 *
 * A recipient who does not recognise the sender needs somewhere to complain
 * that is not a black hole, and an abuse report that can be traced to a key is
 * how a bad customer gets switched off before the sending domain suffers.
 */
const FOOTER_NOTE = `Sent by an application using the ${siteConfig.name} transactional email API.`;

function refuse(code: SendRefusalCode, message: string): CustomerSendResult {
  return { ok: false, code, message };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Turns the plain-text body into template blocks.
 *
 * Blank lines separate paragraphs; nothing else is interpreted. There is no
 * HTML input on purpose — accepting customer HTML would mean either shipping it
 * unescaped into a message sent from the platform's own domain, or sanitising
 * it, and the renderer's guarantee that every interpolated value is escaped is
 * worth more than rich formatting on a receipt.
 */
export function buildBlocks(
  body: string,
  action: { label: string; url: string } | null,
): EmailBlock[] {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_PARAGRAPHS);

  const blocks: EmailBlock[] = paragraphs.map((text) => ({ type: "p", text }));
  if (blocks.length === 0) blocks.push({ type: "p", text: body.trim() });
  if (action) {
    blocks.push({
      type: "cta",
      label: action.label.trim(),
      url: action.url.trim(),
    });
  }
  return blocks;
}
