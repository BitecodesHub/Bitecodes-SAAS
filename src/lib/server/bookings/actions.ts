"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import {
  cancelBooking,
  createBookingConfig,
  deleteBookingConfig,
  getBookingById,
  rotateBookingToken,
  setBookingConfigStatus,
  updateBookingConfig,
} from "@/lib/server/bookings/repository";
import { isValidTimezone } from "@/lib/bookings/availability";
import type { BookingAppearance } from "@/lib/server/db/types";

/**
 * Server Actions for the booking product.
 *
 * Server Actions rather than route handlers so Next's Origin/Host check gives
 * CSRF protection for free. Every action re-authorises with `manage_bookings`,
 * and the owner scope is always the acting session's user id — never a value the
 * client supplies, so a caller cannot reach another tenant's diary by guessing an
 * id.
 *
 * Nothing here does slot arithmetic. Availability is derived by
 * `@/lib/bookings/availability`, which is pure and tested; these actions only
 * decide whether a *rule set* is coherent enough to be stored.
 */

export type BookingActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

/**
 * An IANA zone the runtime actually knows.
 *
 * Checked here and not only at render time because an unknown zone makes
 * `generateSlots` return an empty list rather than throw: the config would look
 * saved and simply never offer a slot again.
 */
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimezone, "Choose a valid time zone, such as Europe/London.");

const nameSchema = z.string().trim().min(2).max(80);

const allowedDomainsSchema = z.array(z.string().trim().max(120)).max(50);

const notifyEmailsSchema = z
  .array(z.string().trim().toLowerCase().email().max(254))
  .max(10);

const MINUTES_IN_DAY = 24 * 60;

/**
 * One weekday window, in the config's own timezone.
 *
 * `endMinute <= startMinute` is rejected rather than normalised. A zero-length or
 * inverted window is silently dropped by the slot generator, so accepting it
 * would report success for availability that produces nothing.
 */
const availabilityWindowSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    startMinute: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_IN_DAY - 1),
    endMinute: z.number().int().min(1).max(MINUTES_IN_DAY),
  })
  .refine(
    (w) => w.endMinute > w.startMinute,
    "Each window must end after it starts.",
  );

const availabilitySchema = z.array(availabilityWindowSchema).max(50);

/** A real calendar day, not merely ten digits shaped like one. */
function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  // Round-trip rejects 2026-02-31 and 2026-13-01, which the regex alone accepts.
  return (
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day
  );
}

const blackoutDatesSchema = z
  .array(
    z
      .string()
      .trim()
      .refine(isCalendarDate, "Blackout dates must be real YYYY-MM-DD dates."),
  )
  .max(370);

/**
 * Appearance — every key of `BookingAppearance` is declared, on purpose.
 *
 * `z.object()` STRIPS unknown keys instead of rejecting them. A key that exists
 * on the document but is missing from this schema is therefore deleted from the
 * payload before any rule can complain, `safeParse` succeeds, the repository is
 * handed a patch without it, and the caller is told the save worked while the
 * value it sent has vanished. That exact shape of silent data loss has already
 * cost this codebase a bug.
 *
 * Two defences: declare every key, and `.strict()` so the next key added to
 * `BookingAppearance` fails loudly here rather than disappearing. The type guard
 * below turns "someone added a key and forgot this file" into a typecheck error.
 */
const appearanceSchema = z
  .object({
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #4f46e5.")
      .optional(),
    buttonText: z.string().trim().min(1).max(40).optional(),
    theme: z.enum(["light", "dark", "auto"]).optional(),
  })
  .strict();

/** Compile-time proof that the schema above covers every appearance key. */
type UndeclaredAppearanceKeys = Exclude<
  keyof BookingAppearance,
  keyof z.infer<typeof appearanceSchema>
>;
type AssertNever<T extends never> = T;
// A key on BookingAppearance that appearanceSchema omits breaks this constraint,
// so the omission surfaces as a typecheck failure rather than as lost data.
// Referenced only by the type system, which eslint cannot see — the whole point
// is that it never runs. Exported so the "unused" reading is simply wrong.
export type AppearanceSchemaIsComplete = AssertNever<UndeclaredAppearanceKeys>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: nameSchema,
  timezone: timezoneSchema,
  allowedDomains: allowedDomainsSchema.optional(),
  notifyEmails: notifyEmailsSchema.optional(),
});

export async function createBookingAction(input: {
  name: string;
  timezone: string;
  allowedDomains?: string[];
  notifyEmails?: string[];
}): Promise<BookingActionResult<{ bookingId: string; publicToken: string }>> {
  const session = await assertCapability("manage_bookings");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      firstIssue(
        parsed.error,
        "Give the booking page a name and a valid time zone.",
      ),
    );
  }

  const created = await createBookingConfig({
    ownerId: session.userId,
    name: parsed.data.name,
    timezone: parsed.data.timezone,
    allowedDomains: parsed.data.allowedDomains ?? [],
    notifyEmails: parsed.data.notifyEmails ?? [],
  });

  await recordAudit({
    action: AUDIT_ACTIONS.bookingCreated,
    actorId: session.userId,
    target: { type: "booking_config", id: created.bookingId },
    detail: { name: parsed.data.name, timezone: parsed.data.timezone },
  });

  revalidatePath("/admin/bookings");
  // The token is returned once, here. Only its SHA-256 is stored.
  return { ok: true, data: created };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Every editable field, all optional: the repository merges what it is given.
 *
 * `slotMinutes` is bounded on both sides. Zero or negative makes the generator
 * return nothing, and an unbounded value would let one "slot" swallow a window
 * whole; five minutes to eight hours covers every real use.
 */
const updateSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  allowedDomains: allowedDomainsSchema.optional(),
  timezone: timezoneSchema.optional(),
  slotMinutes: z
    .number()
    .int()
    .min(5, "A slot must be at least 5 minutes.")
    .max(480, "A slot cannot be longer than 8 hours.")
    .optional(),
  leadTimeHours: z
    .number()
    .int()
    .min(0, "Notice cannot be negative.")
    .max(24 * 90, "Notice cannot exceed 90 days.")
    .optional(),
  horizonDays: z
    .number()
    .int()
    .min(1, "Offer at least one day of availability.")
    .max(365, "Availability cannot run more than a year ahead.")
    .optional(),
  availability: availabilitySchema.optional(),
  blackoutDates: blackoutDatesSchema.optional(),
  notifyEmails: notifyEmailsSchema.optional(),
  confirmationMessage: z.string().trim().min(1).max(500).optional(),
  appearance: appearanceSchema.optional(),
});

export async function updateBookingAction(
  bookingId: string,
  input: z.input<typeof updateSchema>,
): Promise<BookingActionResult> {
  const session = await assertCapability("manage_bookings");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error, "Check the values."));
  }

  const ok = await updateBookingConfig(session.userId, bookingId, {
    ...parsed.data,
    // Widened from number to the 0-6 union the document declares; the schema has
    // already proved the range.
    availability: parsed.data.availability?.map((w) => ({
      day: w.day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
    })),
  });
  if (!ok) return fail("That booking page no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.bookingUpdated,
    actorId: session.userId,
    target: { type: "booking_config", id: bookingId },
    detail: { fields: Object.keys(parsed.data) },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Status, token, deletion
// ---------------------------------------------------------------------------

export async function setBookingStatusAction(
  bookingId: string,
  status: "active" | "paused",
): Promise<BookingActionResult> {
  const session = await assertCapability("manage_bookings");
  if (status !== "active" && status !== "paused") {
    return fail("Unknown status.");
  }

  const ok = await setBookingConfigStatus(session.userId, bookingId, status);
  if (!ok) return fail("That booking page no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.bookingUpdated,
    actorId: session.userId,
    target: { type: "booking_config", id: bookingId },
    detail: { status },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true };
}

/**
 * Issues a new public token and invalidates the old one immediately.
 *
 * Every embed using the previous token stops working the moment this returns,
 * which is the point: it is the remedy for a leaked token.
 */
export async function rotateBookingTokenAction(
  bookingId: string,
): Promise<BookingActionResult<{ publicToken: string }>> {
  const session = await assertCapability("manage_bookings");
  const publicToken = await rotateBookingToken(session.userId, bookingId);
  if (!publicToken) return fail("That booking page no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.bookingUpdated,
    actorId: session.userId,
    target: { type: "booking_config", id: bookingId },
    detail: { rotated: true },
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, data: { publicToken } };
}

/** Deletes the configuration and, with it, its diary. */
export async function deleteBookingAction(
  bookingId: string,
): Promise<BookingActionResult> {
  const session = await assertCapability("manage_bookings");
  const ok = await deleteBookingConfig(session.userId, bookingId);
  if (!ok) return fail("That booking page no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.bookingDeleted,
    actorId: session.userId,
    target: { type: "booking_config", id: bookingId },
  });

  revalidatePath("/admin/bookings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cancelling one appointment
// ---------------------------------------------------------------------------

/**
 * Cancels a single appointment — not the booking page it was made against.
 *
 * Resolved first so the audit entry and the revalidation can name the config,
 * and so an already-cancelled appointment gets a truthful message instead of the
 * "no longer exists" the bare repository call would produce. Cancelling also
 * releases the slot: the unique index is filtered to `status: "confirmed"`, so
 * the time becomes bookable again the moment the status changes.
 */
export async function cancelBookingAction(
  bookingId: string,
): Promise<BookingActionResult> {
  const session = await assertCapability("manage_bookings");

  const booking = await getBookingById(session.userId, bookingId);
  if (!booking) return fail("That booking no longer exists.");
  if (booking.status !== "confirmed") {
    return fail("That booking is already cancelled.");
  }

  const ok = await cancelBooking(session.userId, booking.bookingId);
  if (!ok) return fail("That booking is already cancelled.");

  await recordAudit({
    action: AUDIT_ACTIONS.bookingCancelled,
    actorId: session.userId,
    target: { type: "booking", id: booking.bookingId },
    detail: {
      configId: booking.configId,
      startAt: booking.startAt.toISOString(),
    },
  });

  revalidatePath(`/admin/bookings/${booking.configId}`);
  return { ok: true };
}
