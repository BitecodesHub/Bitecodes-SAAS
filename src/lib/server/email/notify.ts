import "server-only";

import type { EmailBlock } from "@/lib/email/template";
import { isDeliverableEmail, normalizeEmail } from "@/lib/email/address";
import { queueEmail } from "@/lib/server/email/send";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import {
  getSettingsFresh,
  recipientsForChannel,
  type NotificationChannel,
  type ResolvedSettings,
} from "@/lib/server/settings";
import { getServerEnv, getSiteUrl } from "@/lib/server/env";

/**
 * Operator notifications — the emails the platform sends to *itself*.
 *
 * Every product that wants to tell the owner something goes through here, for
 * the same reason every outbound message goes through `email/send.ts`: the
 * decisions that must not be re-litigated per feature (is this notification
 * switched on, who receives it, how often may it fire) belong in one place.
 *
 * Three rules hold for everything in this module:
 *
 *  1. **A notification is never load-bearing.** A failure to send is logged and
 *     swallowed. Losing an alert must never lose the lead, the booking, or the
 *     submission that triggered it — but it must not be silent either, which is
 *     why every catch here logs the reason rather than dropping it.
 *  2. **Transactional, always.** These are messages to the operator about their
 *     own account. They are exempt from the outreach approval queue and carry no
 *     tracking pixel: measuring whether the owner opened their own alert is
 *     surveillance with no purpose.
 *  3. **Throttled at the source.** An event stream the operator does not control
 *     (a busy chatbot, a failing job that retries) must not be able to turn one
 *     inbox into a denial-of-service target. Every entry point here passes
 *     through a counter first.
 */

/** Hard ceiling on how many addresses one notification may reach. */
const MAX_RECIPIENTS = 10;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface NotifyInput {
  channel: NotificationChannel;
  subject: string;
  blocks: EmailBlock[];
  /**
   * A product's own recipient list (a form's `notifyEmails`, a booking config's
   * `notifyEmails`). Merged with the central settings rather than replacing
   * them — see `recipientsForChannel`.
   */
  extraRecipients?: string[];
  /** Identifier of the thing the notification is about, for logging. */
  subjectId?: string | null;
  /** Pre-read settings, when the caller already has a fresh copy. */
  settings?: ResolvedSettings;
}

export interface NotifyResult {
  /** Addresses a message was actually queued for. */
  sent: string[];
  /** Why nothing was sent, when nothing was. */
  skipped: "disabled" | "no-recipients" | "failed" | null;
}

/**
 * Resolves recipients for a channel and queues one message to each.
 *
 * Fresh settings, not cached: a notification that keeps arriving after the
 * owner switched it off is the single most annoying failure mode this module
 * has, and `getSettings` is stale-while-revalidate.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const settings = input.settings ?? (await getSettingsFresh());
  const configured = recipientsForChannel(
    settings,
    input.channel,
    input.extraRecipients ?? [],
  );

  // Nothing configured but the notification is on: fall back to the address the
  // deployment was set up with. Without this, a fresh install has every
  // notification switched on and sends none of them — the operator would first
  // learn that the chatbot alerts existed by reading the code. The settings
  // page shows this address for the same reason.
  const resolved =
    configured.length === 0 &&
    settings.notifications.channels[input.channel].enabled
      ? fallbackNotificationRecipients()
      : configured;

  if (resolved.length === 0) {
    // Two different states, and the difference matters when debugging "why did
    // I not get an email": switched off, versus on with nobody to send to.
    return {
      sent: [],
      skipped: settings.notifications.channels[input.channel].enabled
        ? "no-recipients"
        : "disabled",
    };
  }

  // Undeliverable addresses are dropped here rather than handed to the send
  // pipeline: a bounce from our own notification hurts the same sending domain
  // that customer mail depends on.
  const deliverable = resolved
    .map(normalizeEmail)
    .filter(isDeliverableEmail)
    .slice(0, MAX_RECIPIENTS);

  if (deliverable.length === 0) return { sent: [], skipped: "no-recipients" };

  try {
    await Promise.all(
      deliverable.map((to) =>
        queueEmail({
          to,
          subject: input.subject,
          blocks: input.blocks,
          category: "transactional",
          skipApproval: true,
          track: false,
        }),
      ),
    );
    return { sent: deliverable, skipped: null };
  } catch (error) {
    console.error(
      `[notify] ${input.channel} notification failed for`,
      input.subjectId ?? "(no subject id)",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return { sent: [], skipped: "failed" };
  }
}

// ---------------------------------------------------------------------------
// Chatbot conversation alerts
// ---------------------------------------------------------------------------

/**
 * Longest excerpt of a visitor's question or the assistant's reply that travels
 * in an alert. Enough to judge the lead, short enough that a pasted essay does
 * not become the email.
 */
const EXCERPT_CHARS = 400;

export interface ChatAlertInput {
  chatbotId: string;
  chatbotName: string;
  conversationId: string;
  question: string;
  answer: string;
  /**
   * False when the knowledge base did not cover the question. This is the
   * signal the whole feature exists for: `grounded: false` is precisely
   * "somebody asked us something we have no answer for", which is both the most
   * valuable lead in the product and the clearest instruction for what to add
   * to the knowledge base next.
   */
  grounded: boolean;
  settings?: ResolvedSettings;
}

export type ChatAlertOutcome =
  | { notified: true; kind: "unanswered" | "conversation" }
  | {
      notified: false;
      reason:
        | "disabled"
        | "grounded"
        | "already-alerted"
        | "bot-cap"
        | "failed";
    };

/**
 * Alerts the owner about a chatbot conversation.
 *
 * **Batching.** A chat is many messages, so one email per message is not a
 * feature, it is an outage of somebody's inbox. Two counters bound it:
 *
 *  - **One alert per conversation per day.** The first unanswered question in a
 *    conversation sends; the visitor rephrasing it four times does not. The
 *    conversation id is the natural batch key — the alert says "this
 *    conversation needs you", and saying it twice adds nothing.
 *  - **A per-bot hourly ceiling**, configurable in notification settings
 *    (default 6/hour). A bot suddenly failing every question — a knowledge base
 *    that failed to index, say — produces six emails and then stops, instead of
 *    hundreds.
 *
 * Unanswered and merely-completed conversations use separate counters, so a
 * chatty afternoon of answered questions can never use up the budget that the
 * unanswered ones need. Ungrounded is the priority signal and is protected
 * accordingly.
 */
export async function notifyChatConversation(
  input: ChatAlertInput,
): Promise<ChatAlertOutcome> {
  const settings = input.settings ?? (await getSettingsFresh());
  const prefs = settings.notifications;

  if (!prefs.channels.chatConversation.enabled) {
    return { notified: false, reason: "disabled" };
  }

  const unanswered = !input.grounded;
  if (!unanswered && !prefs.chat.everyConversation) {
    return { notified: false, reason: "grounded" };
  }

  const kind = unanswered ? "unanswered" : "conversation";

  // One alert per conversation per day, per kind. Consumed before the hourly
  // ceiling so a repeat inside the same conversation does not burn the bot's
  // hourly budget on a message that was never going to be sent.
  const perConversation = await consumeRateLimit({
    bucket: `chat-alert-${kind}`,
    key: input.conversationId,
    max: 1,
    windowMs: DAY_MS,
  });
  if (!perConversation.allowed) {
    return { notified: false, reason: "already-alerted" };
  }

  const hourlyCap = Math.max(
    1,
    Math.min(100, prefs.chat.maxAlertsPerBotPerHour),
  );
  const perBot = await consumeRateLimit({
    bucket: `chat-alert-bot-${kind}`,
    key: input.chatbotId,
    // Answered-conversation alerts are the noisy, low-value half, so they get a
    // deliberately smaller share of the same budget.
    max: unanswered ? hourlyCap : Math.max(1, Math.floor(hourlyCap / 2)),
    windowMs: HOUR_MS,
  });
  if (!perBot.allowed) return { notified: false, reason: "bot-cap" };

  const url = `${getSiteUrl()}/admin/chatbots/${input.chatbotId}`;
  const question = excerpt(input.question);
  const answer = excerpt(input.answer);

  const blocks: EmailBlock[] = unanswered
    ? [
        {
          type: "p",
          text: `Someone asked “${input.chatbotName}” a question your knowledge base does not answer. They are still on your site right now.`,
        },
        { type: "h2", text: "They asked" },
        { type: "p", text: question },
        { type: "h2", text: "The assistant replied" },
        { type: "p", text: answer || "(no reply was produced)" },
        {
          type: "p",
          text: "Adding this to the knowledge base means the next visitor who asks gets an answer instead of a shrug.",
        },
        { type: "cta", label: "Open the assistant", url },
      ]
    : [
        {
          type: "p",
          text: `A visitor started a conversation with “${input.chatbotName}”.`,
        },
        { type: "h2", text: "They asked" },
        { type: "p", text: question },
        { type: "h2", text: "The assistant replied" },
        { type: "p", text: answer || "(no reply was produced)" },
        { type: "cta", label: "Open the assistant", url },
      ];

  const result = await notify({
    channel: "chatConversation",
    subject: unanswered
      ? `Unanswered question — ${input.chatbotName}`
      : `New conversation — ${input.chatbotName}`,
    blocks,
    subjectId: input.chatbotId,
    settings,
  });

  if (result.sent.length === 0) {
    return {
      notified: false,
      reason: result.skipped === "failed" ? "failed" : "disabled",
    };
  }
  return { notified: true, kind };
}

function excerpt(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= EXCERPT_CHARS) return collapsed;
  return `${collapsed.slice(0, EXCERPT_CHARS)}…`;
}

// ---------------------------------------------------------------------------
// The other channels
// ---------------------------------------------------------------------------

/**
 * Warns that a product is close to running out of credits.
 *
 * Throttled to one warning per owner per product per day. A wallet at zero
 * generates a refusal on *every* request, and a warning per refusal would spam
 * the inbox of the person who is being asked to fix it — the same reasoning as
 * the forms "out of credits" notice, which stays where it is because it also
 * carries form-specific copy.
 */
export async function notifyLowBalance(input: {
  ownerId: string;
  product: string;
  balance: number;
  extraRecipients?: string[];
}): Promise<NotifyResult> {
  const throttle = await consumeRateLimit({
    bucket: "notify-low-balance",
    key: `${input.ownerId}:${input.product}`,
    max: 1,
    windowMs: DAY_MS,
  });
  if (!throttle.allowed) return { sent: [], skipped: "disabled" };

  return notify({
    channel: "lowBalance",
    subject: `Low credit balance — ${input.product}`,
    blocks: [
      {
        type: "p",
        text: `Your ${input.product} balance is down to ${input.balance} credit${input.balance === 1 ? "" : "s"}. When it reaches zero, requests are refused rather than queued.`,
      },
      { type: "cta", label: "Top up credits", url: `${getSiteUrl()}/admin` },
    ],
    subjectId: input.ownerId,
    extraRecipients: input.extraRecipients,
  });
}

/**
 * Reports a background job that exhausted its retries.
 *
 * Throttled per job *type* rather than per job: when a queue breaks, it breaks
 * for every job of that type at once, and one email per failure would arrive by
 * the hundred while telling the operator exactly one thing.
 */
export async function notifyFailedJob(input: {
  jobType: string;
  jobId: string;
  error: string;
  attempts: number;
}): Promise<NotifyResult> {
  const throttle = await consumeRateLimit({
    bucket: "notify-failed-job",
    key: input.jobType,
    max: 3,
    windowMs: HOUR_MS,
  });
  if (!throttle.allowed) return { sent: [], skipped: "disabled" };

  return notify({
    channel: "failedJob",
    subject: `Background job failed — ${input.jobType}`,
    blocks: [
      {
        type: "p",
        text: `A “${input.jobType}” job gave up after ${input.attempts} attempt${input.attempts === 1 ? "" : "s"}.`,
      },
      {
        type: "ul",
        items: [`Job: ${input.jobId}`, `Error: ${excerpt(input.error)}`],
      },
      {
        type: "p",
        text: "Further failures of this job type are suppressed for the next hour, so check the job queue rather than waiting for more email.",
      },
    ],
    subjectId: input.jobId,
  });
}

/**
 * Announces a new or cancelled booking.
 *
 * Exposed here so the bookings product does not grow its own copy of the
 * recipient-resolution and throttling logic. `extraRecipients` is where a
 * booking config's own `notifyEmails` belongs.
 */
export async function notifyBooking(input: {
  bookingId: string;
  configName: string;
  when: string;
  attendeeName: string;
  cancelled?: boolean;
  extraRecipients?: string[];
  /**
   * The customer's own address.
   *
   * Confirming to them is not optional politeness: the default confirmation text
   * shown in the widget says "We have emailed you the details", so sending only
   * the owner's copy makes the product lie at the moment it takes a booking.
   * Queued separately from the owner notification so one failing does not
   * suppress the other, and so the customer is never shown the owner's admin link.
   */
  attendeeEmail?: string | null;
}): Promise<NotifyResult> {
  const cancelled = input.cancelled ?? false;

  if (input.attendeeEmail && isDeliverableEmail(input.attendeeEmail)) {
    try {
      await queueEmail({
        to: input.attendeeEmail,
        subject: cancelled
          ? `Your booking was cancelled — ${input.configName}`
          : `Your booking is confirmed — ${input.configName}`,
        blocks: [
          {
            type: "p",
            text: cancelled
              ? `Your booking for “${input.configName}” has been cancelled.`
              : `Thanks ${input.attendeeName} — your booking for “${input.configName}” is confirmed.`,
          },
          { type: "ul", items: [`When: ${input.when}`] },
        ],
        category: "transactional",
        skipApproval: true,
        track: false,
      });
    } catch (error) {
      // Never fatal: the booking is already reserved and paid for. Logged, not
      // swallowed, because a silent failure here is indistinguishable from a
      // working confirmation until a customer complains they heard nothing.
      console.error(
        "[bookings] attendee confirmation failed:",
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
    }
  }

  return notify({
    channel: "booking",
    subject: cancelled
      ? `Booking cancelled — ${input.configName}`
      : `New booking — ${input.configName}`,
    blocks: [
      {
        type: "p",
        text: cancelled
          ? `${input.attendeeName} cancelled their booking on “${input.configName}”.`
          : `${input.attendeeName} booked a slot on “${input.configName}”.`,
      },
      {
        type: "ul",
        items: [`When: ${input.when}`, `Reference: ${input.bookingId}`],
      },
      {
        type: "cta",
        label: "Open bookings",
        url: `${getSiteUrl()}/admin/bookings`,
      },
    ],
    subjectId: input.bookingId,
    extraRecipients: input.extraRecipients,
  });
}

/**
 * The addresses used when nothing has been configured anywhere.
 *
 * Surfaced to the settings page so it can say who mail goes to today rather
 * than showing an empty list next to a switch that is on.
 */
export function fallbackNotificationRecipients(): string[] {
  try {
    return getServerEnv().CONTACT_NOTIFICATION_TO;
  } catch {
    return [];
  }
}
