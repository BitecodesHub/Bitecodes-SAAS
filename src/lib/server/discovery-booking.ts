import "server-only";

/**
 * The booking configuration that `/book-a-call` sends visitors to.
 *
 * Every package links to `/book-a-call` rather than to a calendar id, so the
 * destination can change without touching a single page: set
 * `BITECODES_DISCOVERY_BOOKING_ID` to the id of the staff-owned "Discovery
 * call" booking page and every call-to-action follows. When it is absent the
 * route falls back to the contact form with the call intent, which is always
 * available and never sends a visitor to a calendar that does not exist.
 *
 * Read narrowly here rather than through `src/lib/server/env.ts`: that schema
 * belongs to the foundation and validates every required variable at once, so
 * adding an optional marketing setting there would couple it to SMTP and
 * database configuration for no reason.
 */

/** Booking ids are UUIDs created by the booking product. */
const BOOKING_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,100}$/;

export function getDiscoveryBookingId(): string | null {
  const value = process.env.BITECODES_DISCOVERY_BOOKING_ID?.trim();
  if (!value || !BOOKING_ID_PATTERN.test(value)) return null;
  return value;
}

/** Where `/book-a-call` should send the visitor. */
export function getBookACallDestination(): string {
  const bookingId = getDiscoveryBookingId();
  return bookingId
    ? `/book/${encodeURIComponent(bookingId)}`
    : "/contact?intent=call";
}
