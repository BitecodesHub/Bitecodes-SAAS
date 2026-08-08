import { describe, expect, it } from "vitest";
import {
  generateSlots,
  isBookableStart,
  isValidTimezone,
  offsetMinutes,
  utcForZonedTime,
  zonedParts,
  type SlotRules,
} from "@/lib/bookings/availability";

/**
 * Slot arithmetic is the part of a booking product that fails quietly: an
 * off-by-one-hour slot still looks like a slot, and nobody notices until someone
 * misses an appointment. The daylight-saving cases below are the ones that matter
 * — they are why slots are computed rather than stored.
 */

const IST = "Asia/Kolkata"; // No DST, +5:30 — catches half-hour offset bugs.
const LONDON = "Europe/London"; // DST, and the clocks change at 01:00 local.
const NEW_YORK = "America/New_York";

/** Tuesday 09:00-11:00 and Wednesday 09:00-10:00, in whatever zone is passed. */
function rules(overrides: Partial<SlotRules> = {}): SlotRules {
  return {
    timezone: IST,
    slotMinutes: 60,
    leadTimeHours: 0,
    horizonDays: 14,
    availability: [
      { day: 2, startMinute: 9 * 60, endMinute: 11 * 60 },
      { day: 3, startMinute: 9 * 60, endMinute: 10 * 60 },
    ],
    blackoutDates: [],
    ...overrides,
  };
}

describe("zone reading", () => {
  it("reads a UTC instant as local wall-clock parts", () => {
    // 2026-03-10T03:30Z is 09:00 on the 10th in India (+5:30).
    const p = zonedParts(new Date("2026-03-10T03:30:00Z"), IST);
    expect(p.dateKey).toBe("2026-03-10");
    expect(p.minuteOfDay).toBe(9 * 60);
    expect(p.weekday).toBe(2); // Tuesday
  });

  it("handles a half-hour offset zone", () => {
    expect(offsetMinutes(new Date("2026-03-10T00:00:00Z"), IST)).toBe(330);
  });

  it("reports both sides of a daylight-saving change", () => {
    // UK clocks go forward on 2026-03-29.
    expect(offsetMinutes(new Date("2026-03-20T12:00:00Z"), LONDON)).toBe(0);
    expect(offsetMinutes(new Date("2026-04-05T12:00:00Z"), LONDON)).toBe(60);
  });

  it("rejects a zone the runtime does not know", () => {
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone(IST)).toBe(true);
  });
});

describe("wall clock to UTC", () => {
  it("round-trips an ordinary time", () => {
    const utc = utcForZonedTime("2026-03-10", 9 * 60, IST);
    expect(utc?.toISOString()).toBe("2026-03-10T03:30:00.000Z");
  });

  it("is correct on both sides of a DST boundary", () => {
    // 09:00 London is 09:00Z in winter and 08:00Z in summer. A single-pass
    // conversion gets one of these wrong by an hour.
    expect(utcForZonedTime("2026-03-20", 9 * 60, LONDON)?.toISOString()).toBe(
      "2026-03-20T09:00:00.000Z",
    );
    expect(utcForZonedTime("2026-04-05", 9 * 60, LONDON)?.toISOString()).toBe(
      "2026-04-05T08:00:00.000Z",
    );
  });

  it("returns null for a wall-clock time that does not exist", () => {
    // Spring forward in New York 2026-03-08: 02:00-02:59 never happens.
    expect(utcForZonedTime("2026-03-08", 2 * 60 + 30, NEW_YORK)).toBeNull();
    // The hour either side does exist.
    expect(utcForZonedTime("2026-03-08", 60, NEW_YORK)).not.toBeNull();
    expect(utcForZonedTime("2026-03-08", 3 * 60, NEW_YORK)).not.toBeNull();
  });
});

describe("generateSlots", () => {
  const from = new Date("2026-03-09T00:00:00Z"); // Monday

  it("produces slots only on configured weekdays", () => {
    const slots = generateSlots(rules({ horizonDays: 3 }), from);
    const days = new Set(
      slots.map((s) => zonedParts(new Date(s.startIso), IST).weekday),
    );
    expect([...days].sort()).toEqual([2, 3]);
  });

  it("fits whole slots inside a window and never overruns it", () => {
    // A 90-minute slot in a 120-minute window yields exactly one, not one and a half.
    const slots = generateSlots(
      rules({ slotMinutes: 90, horizonDays: 2 }),
      from,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]!.startIso).toBe("2026-03-10T03:30:00.000Z");
    expect(slots[0]!.endIso).toBe("2026-03-10T05:00:00.000Z");
  });

  it("respects the lead time", () => {
    // Nothing within 48 hours of Monday midnight UTC, so Tuesday is excluded.
    const slots = generateSlots(
      rules({ leadTimeHours: 48, horizonDays: 4 }),
      from,
    );
    expect(
      slots.every(
        (s) => new Date(s.startIso) >= new Date("2026-03-11T00:00:00Z"),
      ),
    ).toBe(true);
  });

  it("respects the horizon", () => {
    const slots = generateSlots(rules({ horizonDays: 1 }), from);
    // Only Tuesday is within a day of Monday midnight.
    expect(slots.every((s) => s.startIso.startsWith("2026-03-10"))).toBe(true);
  });

  it("skips blackout dates", () => {
    const slots = generateSlots(
      rules({ horizonDays: 3, blackoutDates: ["2026-03-10"] }),
      from,
    );
    expect(slots.some((s) => s.startIso.startsWith("2026-03-10"))).toBe(false);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("omits slots already taken", () => {
    const all = generateSlots(rules({ horizonDays: 3 }), from);
    const remaining = generateSlots(rules({ horizonDays: 3 }), from, [
      { startIso: all[0]!.startIso, endIso: all[0]!.endIso },
    ]);
    expect(remaining).toHaveLength(all.length - 1);
    expect(remaining.some((s) => s.startIso === all[0]!.startIso)).toBe(false);
  });

  it("keeps the owner's local hour across a DST change", () => {
    // A 09:00 London slot must stay 09:00 London on both sides of the change,
    // which means the UTC instant MOVES. Storing slots would freeze the wrong one.
    const londonRules = rules({
      timezone: LONDON,
      availability: [{ day: 0, startMinute: 9 * 60, endMinute: 10 * 60 }],
      horizonDays: 40,
    });
    const slots = generateSlots(londonRules, new Date("2026-03-15T00:00:00Z"));
    const local = slots.map(
      (s) => zonedParts(new Date(s.startIso), LONDON).minuteOfDay,
    );
    expect(new Set(local)).toEqual(new Set([9 * 60]));
    // And at least one Sunday falls either side of the 29 March change.
    expect(slots.some((s) => s.startIso < "2026-03-29")).toBe(true);
    expect(slots.some((s) => s.startIso > "2026-03-29")).toBe(true);
  });

  it("returns nothing for unusable rules rather than throwing", () => {
    expect(generateSlots(rules({ availability: [] }), from)).toEqual([]);
    expect(generateSlots(rules({ slotMinutes: 0 }), from)).toEqual([]);
    expect(generateSlots(rules({ timezone: "Mars/Olympus" }), from)).toEqual(
      [],
    );
    // A window that ends before it starts is ignored, not inverted.
    expect(
      generateSlots(
        rules({ availability: [{ day: 2, startMinute: 600, endMinute: 300 }] }),
        from,
      ),
    ).toEqual([]);
  });

  it("does not offer the same instant twice when windows overlap", () => {
    const slots = generateSlots(
      rules({
        horizonDays: 2,
        availability: [
          { day: 2, startMinute: 9 * 60, endMinute: 11 * 60 },
          { day: 2, startMinute: 9 * 60, endMinute: 10 * 60 },
        ],
      }),
      from,
    );
    expect(new Set(slots.map((s) => s.startIso)).size).toBe(slots.length);
  });
});

describe("isBookableStart", () => {
  const from = new Date("2026-03-09T00:00:00Z");

  it("accepts a slot it actually offered", () => {
    const slots = generateSlots(rules({ horizonDays: 3 }), from);
    expect(
      isBookableStart(rules({ horizonDays: 3 }), from, slots[0]!.startIso),
    ).toBe(true);
  });

  it("refuses times that were never offered", () => {
    // The request body is caller-controlled: a time in the middle of the night,
    // off the slot grid, or on a closed day must all be rejected server-side.
    for (const iso of [
      "2026-03-10T22:00:00.000Z",
      "2026-03-10T03:45:00.000Z",
      "2026-03-12T03:30:00.000Z",
      "not a date",
    ]) {
      expect(isBookableStart(rules({ horizonDays: 3 }), from, iso), iso).toBe(
        false,
      );
    }
  });

  it("refuses a slot that has just been taken", () => {
    const slots = generateSlots(rules({ horizonDays: 3 }), from);
    const wanted = slots[0]!.startIso;
    expect(
      isBookableStart(rules({ horizonDays: 3 }), from, wanted, [
        { startIso: wanted, endIso: slots[0]!.endIso },
      ]),
    ).toBe(false);
  });
});

describe("overlap, not just equal starts", () => {
  const from = new Date("2026-03-09T00:00:00Z");

  it("refuses a slot that lands inside a longer existing booking", () => {
    // The reported hole: a confirmed 60-minute booking at 09:00, then the owner
    // shortens slots to 30. 09:30 shares no START with it but is squarely inside.
    const taken = [
      {
        startIso: "2026-03-10T03:30:00.000Z",
        endIso: "2026-03-10T04:30:00.000Z",
      },
    ];
    const slots = generateSlots(
      rules({ slotMinutes: 30, horizonDays: 2 }),
      from,
      taken,
    );
    expect(slots.some((s) => s.startIso === "2026-03-10T03:30:00.000Z")).toBe(
      false,
    );
    expect(slots.some((s) => s.startIso === "2026-03-10T04:00:00.000Z")).toBe(
      false,
    );
    // 04:30 begins exactly as the booking ends, so it is still free.
    expect(slots.some((s) => s.startIso === "2026-03-10T04:30:00.000Z")).toBe(
      true,
    );
  });

  it("treats back-to-back appointments as free, not overlapping", () => {
    const taken = [
      {
        startIso: "2026-03-10T03:30:00.000Z",
        endIso: "2026-03-10T04:30:00.000Z",
      },
    ];
    expect(
      isBookableStart(
        rules({ horizonDays: 2 }),
        from,
        "2026-03-10T04:30:00.000Z",
        taken,
      ),
    ).toBe(true);
  });

  it("refuses a partial overlap from either direction", () => {
    const slotRules = rules({ slotMinutes: 60, horizonDays: 2 });
    // Existing 09:30-10:30 straddles the 09:00 and 10:00 slots.
    const taken = [
      {
        startIso: "2026-03-10T04:00:00.000Z",
        endIso: "2026-03-10T05:00:00.000Z",
      },
    ];
    expect(
      isBookableStart(slotRules, from, "2026-03-10T03:30:00.000Z", taken),
    ).toBe(false);
  });
});
