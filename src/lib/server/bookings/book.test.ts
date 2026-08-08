import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { BookingConfigDoc } from "@/lib/server/db/types";

/**
 * Booking-pipeline tests against a real MongoDB.
 *
 * The properties covered here are the ones that protect the owner's calendar
 * and the owner's money: the origin boundary, server-side re-derivation of the
 * slot, the unique-index race producing exactly one booking and exactly one net
 * credit spent, and a cancellation genuinely freeing its time again.
 *
 * A mock would not do: the double-booking guard *is* a partial unique index, so
 * faking the database would be testing the fake.
 */
describeWithDatabase("public booking pipeline", () => {
  useTestDatabase();

  const OWNER = "owner-bk";
  const ORIGIN = "https://example.com";

  /**
   * A fixed clock, so every assertion about which slots exist is deterministic.
   * 2026-09-01 is a Tuesday, and 09:05 sits just inside the 09:00-17:00 window,
   * which makes 09:30 the first offerable slot of the day.
   */
  const NOW = new Date("2026-09-01T09:05:00.000Z");
  const SLOT = "2026-09-01T12:00:00.000Z";

  async function seedConfig(): Promise<BookingConfigDoc> {
    const { createBookingConfig, getBookingConfig, updateBookingConfig } =
      await import("@/lib/server/bookings/repository");
    const { bookingId, publicToken } = await createBookingConfig({
      ownerId: OWNER,
      name: "Discovery call",
      timezone: "UTC",
      allowedDomains: ["example.com"],
    });
    await updateBookingConfig(OWNER, bookingId, {
      timezone: "UTC",
      slotMinutes: 30,
      // No lead time, so the fixed clock alone decides what is offerable.
      leadTimeHours: 0,
      horizonDays: 7,
      availability: [1, 2, 3, 4, 5].map((day) => ({
        day: day as 1 | 2 | 3 | 4 | 5,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      })),
    });
    const config = (await getBookingConfig(OWNER, bookingId))!;
    // Returned so a test can exercise the public lookup as the route does.
    (config as BookingConfigDoc & { __token?: string }).__token = publicToken;
    return config;
  }

  async function fund(amount: number) {
    const { credit } = await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "bookings",
      amount,
      kind: "purchase",
    });
  }

  function customer(extra: Record<string, unknown> = {}) {
    return {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      notes: null,
      ...extra,
    };
  }

  async function confirmedBookings(configId: string) {
    const { bookings } = await import("@/lib/server/db/collections");
    return (await bookings()).find({ configId, status: "confirmed" }).toArray();
  }

  beforeEach(async () => {
    const {
      bookingConfigs,
      bookings,
      walletBalances,
      walletLedger,
      rateLimits,
    } = await import("@/lib/server/db/collections");
    await (await bookingConfigs()).deleteMany({});
    await (await bookings()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
    await (await rateLimits()).deleteMany({});
  });

  afterEach(() => {
    vi.doUnmock("@/lib/server/bookings/repository");
    vi.resetModules();
  });

  it("books an offered slot, spending exactly one credit", async () => {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const config = await seedConfig();
    await fund(5);

    const outcome = await handleBooking({
      config,
      startIso: SLOT,
      customer: customer({ notes: "Looking forward to it." }),
      origin: ORIGIN,
      ip: "203.0.113.5",
      userAgent: "test",
      visitorTimezone: "Asia/Kolkata",
      now: NOW,
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.message).toBe(config.confirmationMessage);
      expect(outcome.startIso).toBe(SLOT);
      expect(outcome.endIso).toBe("2026-09-01T12:30:00.000Z");
    }
    expect(await getBalance(OWNER, "bookings")).toBe(4);

    const [stored] = await confirmedBookings(config.bookingId);
    expect(stored.customerEmail).toBe("ada@example.com");
    // The visitor's IP is stored only as a hash.
    expect(stored.meta.ipHash).toBeTruthy();
    expect(stored.meta.ipHash).not.toBe("203.0.113.5");
  });

  it("refuses a foreign origin, writing no booking and spending nothing", async () => {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const config = await seedConfig();
    await fund(5);

    const outcome = await handleBooking({
      config,
      startIso: SLOT,
      customer: customer(),
      origin: "https://attacker.example.net",
      ip: "203.0.113.6",
      userAgent: null,
      now: NOW,
    });

    expect(outcome.kind).toBe("origin-denied");
    expect(await confirmedBookings(config.bookingId)).toHaveLength(0);
    expect(await getBalance(OWNER, "bookings")).toBe(5);
  });

  it("refuses a time that was never offered", async () => {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const config = await seedConfig();
    await fund(5);

    // Outside the 09:00-17:00 window, off the 30-minute grid, in the past
    // relative to the fixed clock, and not a timestamp at all. None of these
    // ever appeared in a list we produced, so none may be booked.
    const never = [
      "2026-09-01T03:00:00.000Z",
      "2026-09-01T12:07:00.000Z",
      "2026-08-30T12:00:00.000Z",
      "tomorrow please",
    ];

    for (const startIso of never) {
      const outcome = await handleBooking({
        config,
        startIso,
        customer: customer(),
        origin: ORIGIN,
        ip: "203.0.113.7",
        userAgent: null,
        now: NOW,
      });
      expect(outcome.kind, startIso).toBe("slot-unavailable");
    }

    expect(await confirmedBookings(config.bookingId)).toHaveLength(0);
    expect(await getBalance(OWNER, "bookings")).toBe(5);
  });

  it("rejects missing or malformed customer fields without spending", async () => {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const config = await seedConfig();
    await fund(5);

    const outcome = await handleBooking({
      config,
      startIso: SLOT,
      customer: { name: "", email: "not-an-email" },
      origin: ORIGIN,
      ip: "203.0.113.8",
      userAgent: null,
      now: NOW,
    });

    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") {
      expect(Object.keys(outcome.fieldErrors)).toContain("email");
      expect(Object.keys(outcome.fieldErrors)).toContain("name");
    }
    expect(await getBalance(OWNER, "bookings")).toBe(5);
  });

  it("declines at a zero balance and books nothing", async () => {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    const config = await seedConfig();
    // No funding at all.

    const outcome = await handleBooking({
      config,
      startIso: SLOT,
      customer: customer(),
      origin: ORIGIN,
      ip: "203.0.113.9",
      userAgent: null,
      now: NOW,
    });

    expect(outcome.kind).toBe("out-of-credits");
    expect(await confirmedBookings(config.bookingId)).toHaveLength(0);
  });

  it("resolves a race for one slot into one booking and one net credit", async () => {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { walletLedger } = await import("@/lib/server/db/collections");
    const config = await seedConfig();
    await fund(5);

    // Distinct IPs, so the per-visitor rate limit is not what separates them.
    const outcomes = await Promise.all(
      ["203.0.113.20", "203.0.113.21"].map((ip, i) =>
        handleBooking({
          config,
          startIso: SLOT,
          customer: customer({ email: `racer${i}@example.com` }),
          origin: ORIGIN,
          ip,
          userAgent: null,
          now: NOW,
        }),
      ),
    );

    // Exactly one wins. Which way the loser is refused depends on how the two
    // interleave — it either lost the unique index ("slot-taken") or it read
    // the diary after the winner had already written ("slot-unavailable") —
    // and asserting one specific interleaving would make this test flaky about
    // a difference that does not matter. What must hold either way is that one
    // booking exists and one credit was spent.
    expect(outcomes.filter((o) => o.kind === "ok")).toHaveLength(1);
    expect(
      outcomes
        .filter((o) => o.kind !== "ok")
        .every((o) => o.kind === "slot-taken" || o.kind === "slot-unavailable"),
    ).toBe(true);
    expect(await confirmedBookings(config.bookingId)).toHaveLength(1);

    // Both may debit; the loser is refunded, so exactly one credit is spent.
    expect(await getBalance(OWNER, "bookings")).toBe(4);
    const ledger = await (await walletLedger())
      .find({ ownerId: OWNER, product: "bookings" })
      .toArray();
    const net = ledger.reduce((sum, row) => sum + row.delta, 0);
    expect(net).toBe(4);
    expect(ledger.filter((r) => r.kind === "refund")).toHaveLength(
      ledger.filter((r) => r.kind === "deduct").length - 1,
    );
  });

  it("refunds the credit when the insert loses the unique index", async () => {
    const config = await seedConfig();
    await fund(5);

    // The interleaving above cannot be forced, and the refund is the branch
    // that most needs proving: a customer who got nothing must not have paid.
    // So the loss is injected directly at the one place it can occur.
    vi.resetModules();
    vi.doMock("@/lib/server/bookings/repository", async (importOriginal) => {
      const actual =
        await importOriginal<
          typeof import("@/lib/server/bookings/repository")
        >();
      return {
        ...actual,
        createBooking: async () => ({ ok: false, reason: "slot-taken" }),
      };
    });

    const { handleBooking } = await import("@/lib/server/bookings/book");
    const outcome = await handleBooking({
      config,
      startIso: SLOT,
      customer: customer(),
      origin: ORIGIN,
      ip: "203.0.113.40",
      userAgent: null,
      now: NOW,
    });
    expect(outcome.kind).toBe("slot-taken");

    const { getBalance } = await import("@/lib/server/wallet/wallet");
    expect(await getBalance(OWNER, "bookings")).toBe(5);

    const { walletLedger } = await import("@/lib/server/db/collections");
    const ledger = await (await walletLedger())
      .find({ ownerId: OWNER, product: "bookings" })
      .toArray();
    expect(ledger.filter((r) => r.kind === "deduct")).toHaveLength(1);
    expect(ledger.filter((r) => r.kind === "refund")).toHaveLength(1);
  });

  it("frees a slot again once its booking is cancelled", async () => {
    const { handleBooking, loadAvailability } =
      await import("@/lib/server/bookings/book");
    const { cancelBooking } = await import("@/lib/server/bookings/repository");
    const config = await seedConfig();
    await fund(5);

    const first = await handleBooking({
      config,
      startIso: SLOT,
      customer: customer(),
      origin: ORIGIN,
      ip: "203.0.113.30",
      userAgent: null,
      now: NOW,
    });
    expect(first.kind).toBe("ok");

    // While confirmed, the slot is gone from availability and cannot be taken.
    const during = await loadAvailability(config, { now: NOW });
    expect(during.slots.some((s) => s.startIso === SLOT)).toBe(false);

    if (first.kind !== "ok") throw new Error("expected the first slot to book");
    expect(await cancelBooking(OWNER, first.bookingId)).toBe(true);

    // The unique index is partial on "confirmed", so cancelling releases the
    // time rather than poisoning it forever.
    const after = await loadAvailability(config, { now: NOW });
    expect(after.slots.some((s) => s.startIso === SLOT)).toBe(true);

    const second = await handleBooking({
      config,
      startIso: SLOT,
      customer: customer({ email: "grace@example.com" }),
      origin: ORIGIN,
      ip: "203.0.113.31",
      userAgent: null,
      now: NOW,
    });
    expect(second.kind).toBe("ok");
    expect(await confirmedBookings(config.bookingId)).toHaveLength(1);
  });

  it("returns rendering config and free slots, and nothing private", async () => {
    const { loadAvailability } = await import("@/lib/server/bookings/book");
    const config = await seedConfig();

    const view = await loadAvailability(config, { now: NOW, days: 1 });

    expect(view.timezone).toBe("UTC");
    expect(view.slotMinutes).toBe(30);
    expect(view.appearance.buttonText).toBeTruthy();
    expect(view.days).toBe(1);
    // 09:30 through 16:30 on the Tuesday: fifteen half-hours.
    expect(view.slots[0].startIso).toBe("2026-09-01T09:30:00.000Z");
    expect(view.slots.every((s) => s.startIso >= NOW.toISOString())).toBe(true);

    const keys = Object.keys(view);
    expect(keys).not.toContain("ownerId");
    expect(keys).not.toContain("notifyEmails");
    expect(keys).not.toContain("publicTokenHash");
    expect(keys).not.toContain("bookings");
  });

  it("clamps a caller-supplied day window to the config's own horizon", async () => {
    const { resolveWindowDays } = await import("@/lib/server/bookings/book");

    expect(resolveWindowDays("3", 7)).toBe(3);
    expect(resolveWindowDays("3650", 7)).toBe(7);
    expect(resolveWindowDays(null, 7)).toBe(7);
    expect(resolveWindowDays("-4", 7)).toBe(7);
    expect(resolveWindowDays("banana", 7)).toBe(7);
  });

  it("gives one answer for a wrong token and a paused config", async () => {
    const { getBookingConfigForPublic, setBookingConfigStatus } =
      await import("@/lib/server/bookings/repository");
    const config = await seedConfig();
    const token = (config as BookingConfigDoc & { __token?: string }).__token!;

    expect(
      await getBookingConfigForPublic(config.bookingId, "bk_pub_wrong"),
    ).toBeNull();
    await setBookingConfigStatus(OWNER, config.bookingId, "paused");
    expect(await getBookingConfigForPublic(config.bookingId, token)).toBeNull();
  });
});
