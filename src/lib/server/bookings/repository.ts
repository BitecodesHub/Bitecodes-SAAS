import "server-only";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { bookingConfigs, bookings } from "@/lib/server/db/collections";
import { randomToken, sha256Hex } from "@/lib/server/crypto";
import { normalizeDomainPattern } from "@/lib/chatbot/domains";
import type {
  AvailabilityWindow,
  BookingConfigDoc,
  BookingDoc,
} from "@/lib/server/db/types";

/**
 * Tenant-scoped storage for the booking product.
 *
 * Mirrors the forms repository deliberately: an opaque public token whose SHA-256
 * is all that is stored, a fail-closed domain allowlist, and every read scoped by
 * `ownerId` in the query itself rather than by a check the caller might forget.
 *
 * The one thing that is genuinely different is `createBooking`, which relies on a
 * unique index to arbitrate two visitors racing for the same slot. See the note
 * there — it is the only correct way to do it.
 */

/** Sensible starting hours: weekdays, 9 to 5, so a new config is usable at once. */
const DEFAULT_AVAILABILITY: AvailabilityWindow[] = [1, 2, 3, 4, 5].map(
  (day) => ({
    day: day as AvailabilityWindow["day"],
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  }),
);

function normalizeDomains(domains: readonly string[]): string[] {
  return [
    ...new Set(domains.map((d) => normalizeDomainPattern(d)).filter(Boolean)),
  ];
}

export interface CreateBookingConfigInput {
  ownerId: string;
  name: string;
  timezone: string;
  allowedDomains?: string[];
  notifyEmails?: string[];
}

export interface BookingConfigCreated {
  bookingId: string;
  publicToken: string;
}

export async function createBookingConfig(
  input: CreateBookingConfigInput,
): Promise<BookingConfigCreated> {
  const collection = await bookingConfigs();
  const now = new Date();
  const bookingId = randomUUID();
  // Prefixed so a token found in a log or a page source is identifiable at a
  // glance, and cannot be confused with a chatbot or form token.
  const publicToken = `bk_pub_${randomToken(24)}`;

  await collection.insertOne({
    bookingId,
    ownerId: input.ownerId,
    name: input.name,
    description: null,
    status: "active",
    allowedDomains: normalizeDomains(input.allowedDomains ?? []),
    publicTokenHash: sha256Hex(publicToken),
    timezone: input.timezone,
    slotMinutes: 30,
    leadTimeHours: 4,
    horizonDays: 30,
    availability: DEFAULT_AVAILABILITY,
    blackoutDates: [],
    appearance: {
      primaryColor: "#4f46e5",
      buttonText: "Book this time",
      theme: "auto",
    },
    notifyEmails: input.notifyEmails ?? [],
    confirmationMessage:
      "Thanks — your booking is confirmed. We have emailed you the details.",
    bookingCount: 0,
    createdAt: now,
    updatedAt: now,
  } as BookingConfigDoc);

  return { bookingId, publicToken };
}

export async function listBookingConfigs(
  ownerId: string,
): Promise<BookingConfigDoc[]> {
  const collection = await bookingConfigs();
  return collection.find({ ownerId }).sort({ createdAt: -1 }).toArray();
}

export async function getBookingConfig(
  ownerId: string,
  bookingId: string,
): Promise<BookingConfigDoc | null> {
  const collection = await bookingConfigs();
  return collection.findOne({ ownerId, bookingId });
}

/**
 * The public lookup: id plus token, active only.
 *
 * A paused config is indistinguishable from a missing one to the caller, exactly
 * as with chatbots and forms, so the endpoint cannot be used to enumerate.
 */
export async function getBookingConfigForPublic(
  bookingId: string,
  publicToken: string,
): Promise<BookingConfigDoc | null> {
  if (!publicToken || publicToken.length > 200) return null;
  const collection = await bookingConfigs();
  return collection.findOne({
    bookingId,
    publicTokenHash: sha256Hex(publicToken),
    status: "active",
  });
}

export type UpdatableBookingFields = Partial<
  Pick<
    BookingConfigDoc,
    | "name"
    | "description"
    | "allowedDomains"
    | "timezone"
    | "slotMinutes"
    | "leadTimeHours"
    | "horizonDays"
    | "availability"
    | "blackoutDates"
    | "notifyEmails"
    | "confirmationMessage"
  >
> & { appearance?: Partial<BookingConfigDoc["appearance"]> };

export async function updateBookingConfig(
  ownerId: string,
  bookingId: string,
  patch: UpdatableBookingFields,
): Promise<boolean> {
  const collection = await bookingConfigs();
  const set: Record<string, unknown> = { updatedAt: new Date() };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === "allowedDomains" && Array.isArray(value)) {
      set.allowedDomains = normalizeDomains(value as string[]);
    } else if (key === "appearance" && value && typeof value === "object") {
      // Merged field by field so a partial patch cannot blank the rest.
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) set[`appearance.${k}`] = v;
      }
    } else {
      set[key] = value;
    }
  }

  const result = await collection.updateOne(
    { ownerId, bookingId },
    { $set: set },
  );
  return result.matchedCount === 1;
}

export async function setBookingConfigStatus(
  ownerId: string,
  bookingId: string,
  status: "active" | "paused",
): Promise<boolean> {
  const collection = await bookingConfigs();
  const result = await collection.updateOne(
    { ownerId, bookingId },
    { $set: { status, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function rotateBookingToken(
  ownerId: string,
  bookingId: string,
): Promise<string | null> {
  const collection = await bookingConfigs();
  const publicToken = `bk_pub_${randomToken(24)}`;
  const result = await collection.updateOne(
    { ownerId, bookingId },
    {
      $set: { publicTokenHash: sha256Hex(publicToken), updatedAt: new Date() },
    },
  );
  return result.matchedCount === 1 ? publicToken : null;
}

export async function deleteBookingConfig(
  ownerId: string,
  bookingId: string,
): Promise<boolean> {
  const configs = await bookingConfigs();
  const result = await configs.deleteOne({ ownerId, bookingId });
  if (result.deletedCount !== 1) return false;
  // The diary goes with it: an orphaned booking belongs to nothing and would
  // still occupy its slot in any later availability calculation.
  const diary = await bookings();
  await diary.deleteMany({ ownerId, configId: bookingId });
  return true;
}

export interface TakenInterval {
  startIso: string;
  endIso: string;
}

/**
 * Intervals already taken for a config, for the availability calculation.
 *
 * Returns start AND end, not just start, because a booking occupies a span rather
 * than an instant. Matching on the start alone left a real hole: a confirmed
 * 10:00-10:30 booking does not share a start with a 10:15 slot, so after an owner
 * shortened `slotMinutes` — or configured two overlapping windows — a second
 * customer could be confirmed into time that was already sold. Both were charged,
 * and the owner found out when two people arrived.
 *
 * The query deliberately looks back one day before `from`: a long booking that
 * STARTED yesterday can still be running now, and filtering on `startAt` alone
 * would miss it entirely.
 */
export async function takenIntervals(
  configId: string,
  from: Date,
  to: Date,
): Promise<TakenInterval[]> {
  const collection = await bookings();
  const lookBack = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const rows = await collection
    .find(
      { configId, status: "confirmed", startAt: { $gte: lookBack, $lte: to } },
      { projection: { startAt: 1, endAt: 1, _id: 0 } },
    )
    .toArray();
  return rows.map((r) => ({
    startIso: new Date(r.startAt).toISOString(),
    endIso: new Date(r.endAt).toISOString(),
  }));
}

export interface CreateBookingInput {
  ownerId: string;
  configId: string;
  startAt: Date;
  endAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  meta: BookingDoc["meta"];
}

export type CreateBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "slot-taken" };

/**
 * Reserves a slot, or reports that someone else got there first.
 *
 * The race is real and cannot be closed by checking first: two visitors both read
 * "free", both write, and both succeed. So the decision is delegated to the unique
 * index on (configId, startAt, status) — one insert wins, the other raises a
 * duplicate-key error, and that error IS the answer rather than a failure.
 *
 * Only code 11000 is treated this way. Any other write error is a genuine fault
 * and is rethrown, because silently reporting "slot taken" for a database outage
 * would send a customer away from a slot that was actually free.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const collection = await bookings();
  const bookingId = randomUUID();

  try {
    await collection.insertOne({
      bookingId,
      ownerId: input.ownerId,
      configId: input.configId,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "confirmed",
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      notes: input.notes,
      meta: input.meta,
      createdAt: new Date(),
      cancelledAt: null,
    } as BookingDoc);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return { ok: false, reason: "slot-taken" };
    }
    throw error;
  }

  const configs = await bookingConfigs();
  await configs.updateOne(
    { bookingId: input.configId },
    { $inc: { bookingCount: 1 } },
  );

  return { ok: true, bookingId };
}

export async function listBookings(
  ownerId: string,
  configId: string,
  options: { limit?: number; from?: Date } = {},
): Promise<BookingDoc[]> {
  const collection = await bookings();
  const query: Record<string, unknown> = { ownerId, configId };
  if (options.from) query.startAt = { $gte: options.from };
  return collection
    .find(query)
    .sort({ startAt: 1 })
    .limit(Math.min(options.limit ?? 200, 500))
    .toArray();
}

export async function cancelBooking(
  ownerId: string,
  bookingId: string,
): Promise<boolean> {
  const collection = await bookings();
  const result = await collection.updateOne(
    { ownerId, bookingId, status: "confirmed" },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
  );
  return result.matchedCount === 1;
}

/** Used by the admin detail page to resolve a booking by its Mongo id. */
export async function getBookingById(
  ownerId: string,
  id: string,
): Promise<BookingDoc | null> {
  const collection = await bookings();
  if (!ObjectId.isValid(id))
    return collection.findOne({ ownerId, bookingId: id });
  return collection.findOne({ ownerId, _id: new ObjectId(id) });
}
