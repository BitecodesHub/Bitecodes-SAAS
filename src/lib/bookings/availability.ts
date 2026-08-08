/**
 * Slot arithmetic for the booking widget.
 *
 * Pure and dependency-free, so every rule here is unit-testable and the same code
 * runs on the server and in a test. No date library: `Intl.DateTimeFormat` with a
 * `timeZone` already knows every zone and every daylight-saving rule, and it ships
 * with the runtime.
 *
 * The central problem is that two different clocks are in play. An owner authors
 * availability in *their* local time — "Tuesdays, 9 to 5" means their Tuesday —
 * while every instant that gets stored, compared or sent to a browser must be UTC.
 * Slots are therefore COMPUTED from rules rather than stored, because a stored
 * slot would be wrong the moment a clock change moved it, and daylight saving
 * moves it twice a year.
 */

export interface AvailabilityWindowInput {
  day: number;
  startMinute: number;
  endMinute: number;
}

export interface SlotRules {
  timezone: string;
  slotMinutes: number;
  leadTimeHours: number;
  horizonDays: number;
  availability: readonly AvailabilityWindowInput[];
  /** YYYY-MM-DD in the rules' own timezone. */
  blackoutDates: readonly string[];
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Formatter cache: constructing one is expensive and we do it per slot. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** True when the runtime recognises the zone. Guards operator-entered values. */
export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface ZonedParts {
  /** YYYY-MM-DD as read in the target zone. */
  dateKey: string;
  /** 0 = Sunday, matching the stored `day` field. */
  weekday: number;
  minuteOfDay: number;
}

/** Reads a UTC instant as wall-clock parts in the given zone. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    dateKey: `${year}-${month}-${day}`,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    // Some zones report hour 24 for midnight; normalise so arithmetic holds.
    minuteOfDay: (hour % 24) * 60 + minute,
  };
}

/** A zone's UTC offset in minutes at a given instant, DST included. */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const { dateKey, minuteOfDay } = zonedParts(instant, timeZone);
  const [y, m, d] = dateKey.split("-").map(Number);
  // What the wall clock reads, expressed as if it were UTC.
  const asUtc = Date.UTC(y!, m! - 1, d!, 0, minuteOfDay);
  return Math.round((asUtc - instant.getTime()) / MINUTE_MS);
}

/**
 * The UTC instant at which a zone's wall clock reads the given date and minute.
 *
 * Two passes, and the second is not optional. The offset needed to do the
 * conversion is itself a function of the instant being converted, so the first
 * pass uses the offset at an approximation and the second corrects it. Without
 * that correction every booking within an hour of a daylight-saving change lands
 * sixty minutes out — which is precisely when a mistake is most visible.
 *
 * Returns null for a wall-clock time that does not exist, which is what a spring
 * forward creates: 02:30 simply never happens that day, and offering it as a slot
 * would produce a booking nobody can attend.
 */
export function utcForZonedTime(
  dateKey: string,
  minuteOfDay: number,
  timeZone: string,
): Date | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;

  const naive = Date.UTC(y, m - 1, d, 0, minuteOfDay);
  const firstGuess = new Date(
    naive - offsetMinutes(new Date(naive), timeZone) * MINUTE_MS,
  );
  const corrected = new Date(
    naive - offsetMinutes(firstGuess, timeZone) * MINUTE_MS,
  );

  // Round-trip check: if reading the result back does not give the wall time we
  // asked for, that wall time does not exist in this zone on this date.
  const back = zonedParts(corrected, timeZone);
  if (back.dateKey !== dateKey || back.minuteOfDay !== minuteOfDay) return null;
  return corrected;
}

export interface TakenInterval {
  startIso: string;
  endIso: string;
}

/** True when [aStart,aEnd) and [bStart,bEnd) share any time at all. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  // Half-open on purpose: a slot ending exactly when another begins is adjacent,
  // not overlapping, and back-to-back appointments must stay bookable.
  return aStart < bEnd && bStart < aEnd;
}

export interface Slot {
  /** ISO 8601 UTC. */
  startIso: string;
  endIso: string;
}

/**
 * Every bookable slot between `from` and the horizon, minus what is taken.
 *
 * Deliberately excludes: anything before the lead time, anything on a blackout
 * date, anything past the horizon, any slot that would run past the end of its
 * window, and any wall-clock time the zone skips. A slot is offered only if it
 * can actually be honoured.
 */
export function generateSlots(
  rules: SlotRules,
  from: Date,
  taken: readonly TakenInterval[] = [],
): Slot[] {
  const {
    timezone,
    slotMinutes,
    leadTimeHours,
    horizonDays,
    availability,
    blackoutDates,
  } = rules;

  if (slotMinutes <= 0 || horizonDays <= 0 || availability.length === 0) {
    return [];
  }
  if (!isValidTimezone(timezone)) return [];

  const blackout = new Set(blackoutDates);
  // Parsed once: this is compared against every candidate slot.
  const takenMs = taken.map((t) => ({
    start: Date.parse(t.startIso),
    end: Date.parse(t.endIso),
  }));
  const earliest = from.getTime() + leadTimeHours * 60 * MINUTE_MS;
  const horizon = from.getTime() + horizonDays * DAY_MS;

  const byDay = new Map<number, AvailabilityWindowInput[]>();
  for (const w of availability) {
    if (w.endMinute <= w.startMinute) continue;
    byDay.set(w.day, [...(byDay.get(w.day) ?? []), w]);
  }

  const slots: Slot[] = [];

  // Walk local calendar days, not 24-hour steps: a DST day is 23 or 25 hours
  // long, and stepping by milliseconds would skip or repeat one.
  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset += 1) {
    const probe = new Date(from.getTime() + dayOffset * DAY_MS);
    const { dateKey, weekday } = zonedParts(probe, timezone);
    if (blackout.has(dateKey)) continue;

    for (const window of byDay.get(weekday) ?? []) {
      for (
        let minute = window.startMinute;
        minute + slotMinutes <= window.endMinute;
        minute += slotMinutes
      ) {
        const start = utcForZonedTime(dateKey, minute, timezone);
        // Skipped wall-clock time (spring forward) — not offerable.
        if (!start) continue;

        const startMs = start.getTime();
        if (startMs < earliest || startMs > horizon) continue;

        const endMs = startMs + slotMinutes * MINUTE_MS;
        // Any overlap disqualifies the slot, not just an identical start. A
        // shorter slot length must not be able to sell time already booked.
        if (takenMs.some((t) => overlaps(startMs, endMs, t.start, t.end))) {
          continue;
        }
        const startIso = start.toISOString();

        slots.push({ startIso, endIso: new Date(endMs).toISOString() });
      }
    }
  }

  // Chronological, and de-duplicated: overlapping windows on the same day would
  // otherwise offer the same instant twice.
  const seen = new Set<string>();
  return slots
    .filter((s) => (seen.has(s.startIso) ? false : seen.add(s.startIso)))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/**
 * Whether a specific requested start is genuinely bookable right now.
 *
 * The widget offers slots, but the request that arrives is just a timestamp a
 * caller can put anything into. This re-derives the answer server-side rather
 * than trusting that the value came from a list we produced.
 */
export function isBookableStart(
  rules: SlotRules,
  from: Date,
  startIso: string,
  taken: readonly TakenInterval[] = [],
): boolean {
  const parsed = Date.parse(startIso);
  if (Number.isNaN(parsed)) return false;
  const wanted = new Date(parsed).toISOString();
  return generateSlots(rules, from, taken).some((s) => s.startIso === wanted);
}
