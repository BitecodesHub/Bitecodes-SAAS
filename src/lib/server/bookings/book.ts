import "server-only";

import { z } from "zod";
import { isEmbedOriginAllowed } from "@/lib/server/embed-origin";
import {
  generateSlots,
  isBookableStart,
  type Slot,
  type SlotRules,
} from "@/lib/bookings/availability";
import { sha256Hex } from "@/lib/server/crypto";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { credit, debit, getBalance } from "@/lib/server/wallet/wallet";
import {
  createBooking,
  takenIntervals,
} from "@/lib/server/bookings/repository";
import { notifyBooking } from "@/lib/server/email/notify";
import type {
  BookingAppearance,
  BookingConfigDoc,
} from "@/lib/server/db/types";

/**
 * The public booking pipeline: what is free, and taking one of it.
 *
 * No HTTP in here on purpose — the route handlers do transport and CORS, this
 * does the decisions, and the decisions are what the tests exercise.
 *
 * The order of the checks in `handleBooking` is load-bearing, and each step is
 * placed where it is for a reason:
 *
 *  1. **Origin** — the allowlist is the boundary that stops a stranger's site
 *     from filling someone else's diary. Fail closed, and checked server-side
 *     because CORS does not stop a simple POST from being delivered.
 *  2. **Rate limit** — before any paid work, so a burst cannot drain a credit
 *     pack. It runs after the origin check so a refused foreign site cannot
 *     consume the legitimate site's budget.
 *  3. **Validation** — the customer's own fields, strictly.
 *  4. **Re-derive availability** — `isBookableStart` against the *current*
 *     rules and the *current* diary. The widget offers slots, but what arrives
 *     is a timestamp a caller can put anything into: a time we never offered,
 *     a time inside the lead window, a time on a blackout date. Trusting the
 *     posted value would let anyone book outside business hours.
 *  5. **Credits** — balance checked before the work, debited for it. Metering
 *     has to mean something, so a zero balance refuses the booking outright.
 *  6. **Insert, and refund if the race was lost.** Two visitors can both pass
 *     step 4 and only one insert can win the unique index. The loser is told
 *     the slot went, and *the credit is given back*, because the customer got
 *     nothing. Charging for a booking that does not exist is the one outcome
 *     here that is indefensible.
 */

const CREDITS_PER_BOOKING = 1;

/** Slot lists are for a widget to render; a month of 15-minute slots is plenty. */
const MAX_SLOTS_RETURNED = 500;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export interface AvailabilityView {
  bookingId: string;
  name: string;
  description: string | null;
  /** The zone the slots are authored in, so the widget can label them. */
  timezone: string;
  slotMinutes: number;
  appearance: BookingAppearance;
  /** How many days ahead this answer covers. */
  days: number;
  slots: Slot[];
}

/**
 * Clamps a caller-supplied `days` to something the config actually offers.
 *
 * A visitor asking for 3650 days must not be able to make the server generate
 * ten years of slots, and a config's own horizon is the ceiling regardless.
 */
export function resolveWindowDays(
  requested: unknown,
  horizonDays: number,
): number {
  const horizon = Math.max(1, Math.min(horizonDays, 365));
  const asNumber =
    typeof requested === "number" ? requested : Number(requested ?? NaN);
  if (!Number.isFinite(asNumber) || asNumber < 1) return horizon;
  return Math.min(Math.floor(asNumber), horizon);
}

/** A `BookingConfigDoc` already satisfies `SlotRules` structurally. */
function rulesFor(config: BookingConfigDoc, days: number): SlotRules {
  return {
    timezone: config.timezone,
    slotMinutes: config.slotMinutes,
    leadTimeHours: config.leadTimeHours,
    horizonDays: days,
    availability: config.availability,
    blackoutDates: config.blackoutDates,
  };
}

const DAY_MS = 86_400_000;

/**
 * Free slots for a config: everything the rules generate, minus the diary.
 *
 * Returns the timezone, slot length and appearance alongside, so the widget can
 * render a complete picker from this one call rather than making a second one.
 * It deliberately returns nothing else — no `ownerId`, no `notifyEmails`, no
 * token hash, and no bookings — so publishing this endpoint to every allowed
 * website leaks nothing about the account behind it or the people in its diary.
 */
export async function loadAvailability(
  config: BookingConfigDoc,
  options: { days?: unknown; now?: Date } = {},
): Promise<AvailabilityView> {
  const now = options.now ?? new Date();
  const days = resolveWindowDays(options.days, config.horizonDays);

  // One day of slack on the upper bound: the last day's slots can start after
  // the naive `now + days` instant once a zone offset is applied.
  const taken = await takenIntervals(
    config.bookingId,
    now,
    new Date(now.getTime() + (days + 1) * DAY_MS),
  );

  const slots = generateSlots(rulesFor(config, days), now, taken).slice(
    0,
    MAX_SLOTS_RETURNED,
  );

  return {
    bookingId: config.bookingId,
    name: config.name,
    description: config.description,
    timezone: config.timezone,
    slotMinutes: config.slotMinutes,
    appearance: config.appearance,
    days,
    slots,
  };
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/**
 * The customer's own fields.
 *
 * Trimmed and length-capped rather than merely typed: these end up in an email
 * to the owner and on an admin screen, so an unbounded `notes` is a storage and
 * a rendering problem. `strict()` is not used — the route strips the transport
 * keys and passes the rest, and unknown keys are simply ignored rather than
 * stored, since nothing here is persisted except the fields named below.
 */
export const bookingCustomerSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type BookingCustomer = z.infer<typeof bookingCustomerSchema>;

export type BookingOutcome =
  | {
      kind: "ok";
      bookingId: string;
      message: string;
      startIso: string;
      endIso: string;
    }
  | { kind: "origin-denied" }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "invalid"; fieldErrors: Record<string, string[]> }
  /** The requested time is not one this config offers right now. */
  | { kind: "slot-unavailable" }
  /** It was offerable a moment ago; someone else got it first. */
  | { kind: "slot-taken" }
  | { kind: "out-of-credits" };

export interface BookingRequestInput {
  config: BookingConfigDoc;
  /** Untrusted: the requested slot start, as posted. */
  startIso: unknown;
  /** Untrusted: the customer's fields, as posted. */
  customer: unknown;
  origin: string | null;
  ip: string | null;
  userAgent: string | null;
  /** The visitor's own IANA zone, recorded for the confirmation email. */
  visitorTimezone?: string | null;
  now?: Date;
}

function ipHashOf(ip: string | null): string | null {
  return ip ? sha256Hex(ip) : null;
}

export async function handleBooking(
  input: BookingRequestInput,
): Promise<BookingOutcome> {
  const { config } = input;
  const now = input.now ?? new Date();

  // 1. Origin allowlist — fail closed.
  if (!isEmbedOriginAllowed(input.origin, config.allowedDomains)) {
    return { kind: "origin-denied" };
  }

  // 2. Rate limits, before anything that costs money.
  const ipHash = ipHashOf(input.ip);
  const perVisitor = await consumeNamedRateLimit(
    "formSubmit",
    `booking:${config.bookingId}:${ipHash ?? "unknown"}`,
  );
  if (!perVisitor.allowed) {
    return {
      kind: "rate-limited",
      retryAfterSeconds: perVisitor.retryAfterSeconds,
    };
  }
  const perConfig = await consumeNamedRateLimit(
    "formSubmitPerForm",
    `booking:${config.bookingId}`,
  );
  if (!perConfig.allowed) {
    return {
      kind: "rate-limited",
      retryAfterSeconds: perConfig.retryAfterSeconds,
    };
  }

  // 3. The customer's fields.
  const parsed = bookingCustomerSchema.safeParse(input.customer);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { kind: "invalid", fieldErrors };
  }

  // 4. Re-derive the slot server-side. Never trust that the posted time came
  //    from a list we produced.
  if (typeof input.startIso !== "string") return { kind: "slot-unavailable" };
  const requested = Date.parse(input.startIso);
  if (Number.isNaN(requested)) return { kind: "slot-unavailable" };
  const startAt = new Date(requested);
  const startIso = startAt.toISOString();

  const rules = rulesFor(config, Math.max(1, config.horizonDays));
  // Only the diary around the requested instant matters to this decision, and
  // asking for exactly that keeps the query small on a busy calendar.
  const taken = await takenIntervals(
    config.bookingId,
    new Date(requested - DAY_MS),
    new Date(requested + DAY_MS),
  );
  if (!isBookableStart(rules, now, startIso, taken)) {
    return { kind: "slot-unavailable" };
  }

  const endAt = new Date(requested + config.slotMinutes * 60_000);

  // 5. Check the balance, then pay for the booking.
  const balance = await getBalance(config.ownerId, "bookings");
  if (balance < CREDITS_PER_BOOKING) return { kind: "out-of-credits" };

  const spend = await debit({
    ownerId: config.ownerId,
    product: "bookings",
    amount: CREDITS_PER_BOOKING,
    subjectId: config.bookingId,
    note: `booking:${config.name}`,
    now,
  });
  if (!spend.ok) return { kind: "out-of-credits" };

  // 6. Insert. The unique partial index arbitrates the race.
  const created = await createBooking({
    ownerId: config.ownerId,
    configId: config.bookingId,
    startAt,
    endAt,
    customerName: parsed.data.name,
    customerEmail: parsed.data.email,
    customerPhone: parsed.data.phone,
    notes: parsed.data.notes,
    meta: {
      ipHash,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      origin: input.origin,
      timezone: input.visitorTimezone?.slice(0, 100) ?? null,
    },
  });

  if (!created.ok) {
    // Lost the race. The customer has no booking, so they must not have paid
    // for one — refund before answering, not on a later reconciliation job.
    await credit({
      ownerId: config.ownerId,
      product: "bookings",
      amount: CREDITS_PER_BOOKING,
      kind: "refund",
      subjectId: config.bookingId,
      note: `slot-taken:${startIso}`,
      now,
    });
    return { kind: "slot-taken" };
  }

  // Tell the owner, and confirm to the customer.
  //
  // The default confirmation text says "We have emailed you the details", so not
  // sending anything makes the product lie to a paying customer at the exact
  // moment it takes their booking. Best effort and outside the money path: a
  // failed notification must not undo a reservation that succeeded, but it must
  // not be silent either — see the note in forms/submit.ts about a swallowed
  // reason being undiagnosable.
  try {
    await notifyBooking({
      bookingId: created.bookingId,
      configName: config.name,
      when: formatWhen(startAt, config.timezone),
      attendeeName: parsed.data.name,
      extraRecipients: config.notifyEmails,
      attendeeEmail: parsed.data.email,
    });
  } catch (error) {
    console.error(
      "[bookings] confirmation could not be queued for",
      created.bookingId,
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }

  return {
    kind: "ok",
    bookingId: created.bookingId,
    message: config.confirmationMessage,
    startIso,
    endIso: endAt.toISOString(),
  };
}

/**
 * The appointment time as the OWNER reads it.
 *
 * Deliberately in the config's timezone with the zone named. A bare ISO string in
 * a notification is how someone ends up at the right number on the wrong clock.
 */
function formatWhen(startAt: Date, timeZone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        dateStyle: "full",
        timeStyle: "short",
        hour12: false,
      }).format(startAt) + ` (${timeZone})`
    );
  } catch {
    return startAt.toISOString();
  }
}
