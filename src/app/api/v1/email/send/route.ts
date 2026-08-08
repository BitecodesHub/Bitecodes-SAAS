import { z } from "zod";
import {
  authenticateRequest,
  jsonError,
  jsonOk,
} from "@/lib/server/chatbot/rest-auth";
import { sha256Hex } from "@/lib/server/crypto";
import {
  sendCustomerEmail,
  MAX_BODY_CHARS,
  MAX_SUBJECT_CHARS,
} from "@/lib/server/email/customer-send";

export const dynamic = "force-dynamic";

/**
 * `POST /api/v1/email/send` — send transactional email from a customer's own
 * application.
 *
 * ## What this endpoint is for
 *
 * Mail a specific person is expecting because of something they just did:
 * password resets, order and booking confirmations, receipts, "your export is
 * ready", one-time codes, an alert about their own account.
 *
 * ## What this endpoint is NOT for
 *
 * **Bulk email. Cold email. Marketing of any kind.** Newsletters, campaigns,
 * product announcements, drip sequences, anything addressed to a list, and
 * anything sent to somebody who did not ask for it. This is not a policy
 * pinned to the docs and forgotten — it is what the endpoint is built out of:
 *
 *  - The From address is always the platform's own verified sender. There is no
 *    field for your own; a customer-controlled From on a shared sending domain
 *    is how a shared domain ends up on a blocklist.
 *  - At most 10 recipients per request, each receiving a separate message. No
 *    BCC, no list upload, no audience.
 *  - A hard cap of 200 recipients per API key per day. Both numbers are
 *    `MAX_RECIPIENTS_PER_REQUEST` and `DAILY_RECIPIENT_CAP` in
 *    `email/customer-send.ts`, which is also where they are enforced.
 *  - The platform suppression list applies: an unsubscribe recorded anywhere
 *    blocks a send from everywhere.
 *  - No open tracking, no click tracking, and no unsubscribe link — because
 *    there is nothing to unsubscribe from. If your message needs an unsubscribe
 *    link, it is marketing, and it does not belong here.
 *
 * Use a dedicated bulk-email provider for campaigns. Sending marketing through
 * this endpoint damages a sending reputation shared by every customer on the
 * platform, and keys that do it are revoked.
 *
 * ## Authentication
 *
 * The existing REST Bearer keys: `Authorization: Bearer sk_live_…`. The key
 * must carry the **`email` scope**, which is granted deliberately and is not on
 * a key by default — an endpoint that spends credits and sends mail on your
 * domain should not be reachable by a key minted to read a chatbot config.
 *
 * ## Request
 *
 * ```json
 * {
 *   "to": ["person@example.com"],
 *   "subject": "Your receipt",
 *   "body": "Thanks for your order.\n\nYour receipt is attached below.",
 *   "action": { "label": "View receipt", "url": "https://example.com/r/1" }
 * }
 * ```
 *
 * `body` is plain text; blank lines separate paragraphs and HTML is not
 * accepted. `action` is an optional single button.
 *
 * ## Billing
 *
 * One `email` wallet credit per recipient, charged when the message is queued
 * and refunded automatically for any recipient the pipeline then refused.
 *
 * ## Responses
 *
 * `200` with `{ accepted, rejected, charged, balanceAfter }` — note that a 200
 * can still carry rejected recipients, because one bad address in a list of
 * five must not fail the other four. `401`/`403` for the key, `422` for a
 * malformed request, `402` when credits run out, `429` for the burst limit and
 * the daily cap (with `Retry-After`), and `409` when no recipient was
 * acceptable.
 *
 * There is no CORS handling and no `OPTIONS` handler, deliberately: this is a
 * server-to-server endpoint, and a secret key that works from a browser is a
 * secret key published to every visitor.
 */

const sendSchema = z.object({
  to: z.union([
    z.string().trim().min(3).max(254),
    z.array(z.string().trim().min(3).max(254)).min(1).max(50),
  ]),
  subject: z.string().trim().min(1).max(MAX_SUBJECT_CHARS),
  body: z.string().min(1).max(MAX_BODY_CHARS),
  action: z
    .object({
      label: z.string().trim().min(1).max(60),
      url: z.string().trim().min(1).max(2_000),
    })
    .nullish(),
});

/**
 * Fields that exist on other providers' send APIs and are refused here rather
 * than ignored.
 *
 * Silently dropping `from` would mean a customer believes they are sending as
 * themselves while the platform's address goes out — they would discover the
 * truth from a confused recipient. Naming the field and saying why is the whole
 * difference between a bounded product and a surprising one.
 */
const REFUSED_FIELDS: Record<string, string> = {
  from: "The sender is always the platform's verified address; a customer-supplied From is never accepted.",
  sender:
    "The sender is always the platform's verified address; a customer-supplied From is never accepted.",
  replyTo: "Reply-to is fixed to the platform's contact address.",
  reply_to: "Reply-to is fixed to the platform's contact address.",
  html: "Only plain text is accepted. Send 'body' as text; blank lines separate paragraphs.",
  cc: "Every recipient gets their own message. List each address in 'to'.",
  bcc: "Every recipient gets their own message. List each address in 'to'.",
  attachments: "Attachments are not supported. Link to the file instead.",
  track: "This endpoint never tracks opens or clicks.",
  tracking: "This endpoint never tracks opens or clicks.",
  category:
    "Only transactional mail is sent here. Marketing and bulk email are not supported.",
};

export async function POST(request: Request) {
  // Scope is required, not optional: this is the one REST endpoint that both
  // spends credits and puts mail on the platform's sending domain.
  const auth = await authenticateRequest(request, "email");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_request", "Body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "bad_request", "Body must be a JSON object.");
  }

  for (const [field, reason] of Object.entries(REFUSED_FIELDS)) {
    if (field in (body as Record<string, unknown>)) {
      return jsonError(422, "unsupported_field", `'${field}': ${reason}`);
    }
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(
      422,
      "validation",
      first
        ? `${first.path.join(".") || "body"}: ${first.message}`
        : "Send 'to', 'subject', and 'body'.",
    );
  }

  // The key's own hash: the same value the database stores, stable for the life
  // of the key, and not the secret. Exactly what a per-key counter needs.
  const secret = /^Bearer\s+(.+)$/i
    .exec(request.headers.get("authorization")?.trim() ?? "")?.[1]
    ?.trim();
  if (!secret) {
    return jsonError(401, "unauthorized", "Missing or invalid API key.");
  }

  const result = await sendCustomerEmail({
    ownerId: auth.key.ownerId,
    keyId: sha256Hex(secret),
    to: Array.isArray(parsed.data.to) ? parsed.data.to : [parsed.data.to],
    subject: parsed.data.subject,
    body: parsed.data.body,
    action: parsed.data.action ?? null,
  });

  if (!result.ok) {
    const status = STATUS_FOR_CODE[result.code];
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (result.retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(result.retryAfterSeconds);
    }
    // Built here rather than through `jsonError` so the per-recipient reasons
    // survive. "No recipient was acceptable" without saying which one was
    // suppressed and which one was a typo is an unanswerable support ticket.
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: result.code,
          message: result.message,
          rejected: result.rejected ?? [],
        },
      }),
      { status, headers },
    );
  }

  return jsonOk({
    accepted: result.accepted,
    rejected: result.rejected,
    charged: result.charged,
    balanceAfter: result.balanceAfter,
  });
}

const STATUS_FOR_CODE = {
  validation: 422,
  rate_limited: 429,
  daily_cap: 429,
  insufficient_credits: 402,
  no_valid_recipients: 409,
} as const;
