import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type {
  AdminUserDoc,
  BookingConfigDoc,
  BookingDoc,
  SiteSettingsDoc,
} from "@/lib/server/db/types";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("reminder windows", () => {
  it("selects the hour-before note between 45 and 75 minutes out", async () => {
    const { reminderTierFor } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const now = new Date("2026-09-01T09:00:00.000Z");

    expect(reminderTierFor(new Date(now.getTime() + 45 * MINUTE_MS), now)).toBe(
      "1h",
    );
    expect(reminderTierFor(new Date(now.getTime() + 60 * MINUTE_MS), now)).toBe(
      "1h",
    );
    expect(reminderTierFor(new Date(now.getTime() + 75 * MINUTE_MS), now)).toBe(
      "1h",
    );
    expect(reminderTierFor(new Date(now.getTime() + 30 * MINUTE_MS), now)).toBe(
      null,
    );
  });

  it("selects the day-before note between 23 and 25 hours out", async () => {
    const { reminderTierFor } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const now = new Date("2026-09-01T09:00:00.000Z");

    expect(reminderTierFor(new Date(now.getTime() + 23 * HOUR_MS), now)).toBe(
      "24h",
    );
    expect(reminderTierFor(new Date(now.getTime() + 24 * HOUR_MS), now)).toBe(
      "24h",
    );
    expect(reminderTierFor(new Date(now.getTime() + 25 * HOUR_MS), now)).toBe(
      "24h",
    );
    expect(reminderTierFor(new Date(now.getTime() + 26 * HOUR_MS), now)).toBe(
      null,
    );
  });
});

describeWithDatabase("booking reminders handler", () => {
  useTestDatabase();

  const CONFIG_ID = "bk-reminder-test";
  const OWNER = "64b000000000000000000001";
  const CUSTOMER = "64b000000000000000000002";

  function context(deadline = Date.now() + 60_000) {
    const lines: string[] = [];
    return {
      context: {
        jobId: "job-reminder-test",
        attempts: 1,
        deadline,
        log: (line: string) => lines.push(line),
      },
      lines,
    };
  }

  function config(
    now: Date,
    overrides: Partial<BookingConfigDoc> = {},
  ): BookingConfigDoc {
    return {
      bookingId: CONFIG_ID,
      ownerId: OWNER,
      name: "Discovery call",
      description: null,
      status: "active",
      allowedDomains: ["example.com"],
      publicTokenHash: "hash",
      timezone: "UTC",
      slotMinutes: 30,
      leadTimeHours: 0,
      horizonDays: 30,
      availability: [],
      blackoutDates: [],
      appearance: {
        primaryColor: "#111111",
        buttonText: "Book this time",
        theme: "auto",
      },
      notifyEmails: [],
      confirmationMessage: "Confirmed.",
      bookingCount: 0,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  function staffUser(now: Date, role: AdminUserDoc["role"] = "owner") {
    return {
      _id: new ObjectId(OWNER),
      email: "owner-reminder@example.com",
      name: "Reminder Owner",
      role,
      passwordHash: "test",
      status: "active",
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      sessionEpoch: 0,
      createdAt: now,
      updatedAt: now,
    } as AdminUserDoc;
  }

  function booking(input: {
    id: string;
    startAt: Date;
    now: Date;
    status?: BookingDoc["status"];
    email?: string;
    ownerId?: string;
    configId?: string;
  }): BookingDoc {
    return {
      bookingId: input.id,
      ownerId: input.ownerId ?? OWNER,
      configId: input.configId ?? CONFIG_ID,
      startAt: input.startAt,
      endAt: new Date(input.startAt.getTime() + 30 * MINUTE_MS),
      status: input.status ?? "confirmed",
      customerName: "Ada Lovelace",
      customerEmail: input.email ?? `${input.id}@example.com`,
      customerPhone: null,
      notes: null,
      meta: {
        ipHash: null,
        userAgent: null,
        origin: "https://example.com",
        timezone: "Asia/Kolkata",
      },
      createdAt: input.now,
      cancelledAt: input.status === "cancelled" ? input.now : null,
    };
  }

  beforeEach(async () => {
    const {
      adminUsers,
      bookingConfigs,
      bookings,
      emailMessages,
      jobs,
      siteSettings,
    } = await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await (await bookingConfigs()).deleteMany({});
    await (await bookings()).deleteMany({});
    await (await emailMessages()).deleteMany({});
    await (await jobs()).deleteMany({});
    await (await siteSettings()).deleteMany({});
    await (await adminUsers()).insertOne(staffUser(new Date()));
  });

  it("sends each reminder once and never for cancelled or distant bookings", async () => {
    const { handleBookingReminders } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const { bookingConfigs, bookings, emailMessages } =
      await import("@/lib/server/db/collections");

    const now = new Date();
    await (await bookingConfigs()).insertOne(config(now));
    await (
      await bookings()
    ).insertMany([
      booking({
        id: "day-before",
        startAt: new Date(now.getTime() + 24 * HOUR_MS),
        now,
        email: "day@example.com",
      }),
      booking({
        id: "hour-before",
        startAt: new Date(now.getTime() + 60 * MINUTE_MS),
        now,
        email: "hour@example.com",
      }),
      booking({
        id: "too-far",
        startAt: new Date(now.getTime() + 26 * HOUR_MS),
        now,
        email: "far@example.com",
      }),
      booking({
        id: "cancelled",
        startAt: new Date(now.getTime() + 24 * HOUR_MS),
        now,
        status: "cancelled",
        email: "cancelled@example.com",
      }),
    ]);

    const first = context();
    const summary = await handleBookingReminders({}, first.context);

    expect(summary).toMatchObject({
      checked: 2,
      sent24h: 1,
      sent1h: 1,
      failed: 0,
    });

    const messages = await (await emailMessages()).find({}).toArray();
    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.to).sort()).toEqual([
      "day@example.com",
      "hour@example.com",
    ]);
    expect(
      messages.find((message) => message.to === "day@example.com")?.subject,
    ).toContain("tomorrow");
    expect(
      messages.find((message) => message.to === "hour@example.com")?.subject,
    ).toContain("one hour");

    const stored = await (await bookings()).find({}).toArray();
    expect(
      stored.find((row) => row.bookingId === "day-before")?.reminder24hSentAt,
    ).toBeInstanceOf(Date);
    expect(
      stored.find((row) => row.bookingId === "hour-before")?.reminder1hSentAt,
    ).toBeInstanceOf(Date);
    expect(
      stored.find((row) => row.bookingId === "too-far")?.reminder24hSentAt,
    ).toBeUndefined();
    expect(
      stored.find((row) => row.bookingId === "cancelled")?.reminder24hSentAt,
    ).toBeUndefined();

    // A second run, a moment later, must not send either reminder again.
    const second = context();
    const rerun = await handleBookingReminders({}, second.context);
    expect(rerun).toMatchObject({
      checked: 2,
      sent24h: 0,
      sent1h: 0,
      skipped: 2,
    });
    expect(await (await emailMessages()).countDocuments({})).toBe(2);
  });

  it("does nothing when the growth toggle is off", async () => {
    const { handleBookingReminders } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const { bookingConfigs, bookings, emailMessages, siteSettings } =
      await import("@/lib/server/db/collections");

    const now = new Date();
    await (await bookingConfigs()).insertOne(config(now));
    await (
      await bookings()
    ).insertOne(
      booking({
        id: "disabled",
        startAt: new Date(now.getTime() + 24 * HOUR_MS),
        now,
      }),
    );
    await (
      await siteSettings()
    ).insertOne({
      _id: "site",
      growth: { bookingReminders: false },
      createdAt: now,
      updatedAt: now,
    } as SiteSettingsDoc);

    const run = context();
    const summary = await handleBookingReminders({}, run.context);

    expect(summary).toEqual({ skipped: "disabled" });
    expect(await (await emailMessages()).countDocuments({})).toBe(0);
    const stored = await (await bookings()).findOne({ bookingId: "disabled" });
    expect(stored?.reminder24hSentAt).toBeUndefined();
  });

  it("leaves a customer calendar alone until the customer opts in", async () => {
    const { handleBookingReminders } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const { adminUsers, bookingConfigs, bookings, emailMessages } =
      await import("@/lib/server/db/collections");

    const now = new Date();
    await (
      await adminUsers()
    ).insertOne({
      ...staffUser(now, "customer"),
      _id: new ObjectId(CUSTOMER),
      email: "customer-reminder@example.com",
    } as AdminUserDoc);
    await (
      await bookingConfigs()
    ).insertOne(config(now, { ownerId: CUSTOMER }));
    await (
      await bookings()
    ).insertOne(
      booking({
        id: "customer-not-opted-in",
        startAt: new Date(now.getTime() + 24 * HOUR_MS),
        now,
        ownerId: CUSTOMER,
      }),
    );

    const run = context();
    const summary = await handleBookingReminders({}, run.context);

    expect(summary).toMatchObject({
      checked: 0,
      sent24h: 0,
      sent1h: 0,
      skipped: 1,
    });
    expect(await (await emailMessages()).countDocuments({})).toBe(0);
  });

  it("reminds a customer calendar that has opted in", async () => {
    const { handleBookingReminders } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const { adminUsers, bookingConfigs, bookings, emailMessages } =
      await import("@/lib/server/db/collections");

    const now = new Date();
    await (
      await adminUsers()
    ).insertOne({
      ...staffUser(now, "customer"),
      _id: new ObjectId(CUSTOMER),
      email: "customer-reminder@example.com",
    } as AdminUserDoc);
    await (
      await bookingConfigs()
    ).insertOne(config(now, { ownerId: CUSTOMER, remindersEnabled: true }));
    await (
      await bookings()
    ).insertOne(
      booking({
        id: "customer-opted-in",
        startAt: new Date(now.getTime() + 24 * HOUR_MS),
        now,
        ownerId: CUSTOMER,
      }),
    );

    const run = context();
    const summary = await handleBookingReminders({}, run.context);

    expect(summary).toMatchObject({ checked: 1, sent24h: 1, sent1h: 0 });
    const messages = await (await emailMessages()).find({}).toArray();
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe("customer-opted-in@example.com");
  });

  it("stops before the deadline without claiming any reminder", async () => {
    const { handleBookingReminders } =
      await import("@/lib/server/jobs/handlers/booking-reminders");
    const { bookingConfigs, bookings, emailMessages } =
      await import("@/lib/server/db/collections");

    const now = new Date();
    await (await bookingConfigs()).insertOne(config(now));
    await (
      await bookings()
    ).insertOne(
      booking({
        id: "deadline",
        startAt: new Date(now.getTime() + 24 * HOUR_MS),
        now,
      }),
    );

    const run = context(Date.now() - 1);
    const summary = await handleBookingReminders({}, run.context);

    expect(summary).toMatchObject({
      sent24h: 0,
      sent1h: 0,
      stoppedEarly: true,
    });
    expect(await (await emailMessages()).countDocuments({})).toBe(0);
    const stored = await (await bookings()).findOne({ bookingId: "deadline" });
    expect(stored?.reminder24hSentAt).toBeUndefined();
  });
});
