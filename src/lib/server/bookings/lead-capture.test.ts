import { beforeEach, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type {
  AdminRole,
  AdminUserDoc,
  BookingConfigDoc,
} from "@/lib/server/db/types";

/**
 * A booking on a staff calendar is a sales conversation and belongs in the CRM.
 * A booking on a self-serve customer's calendar is that customer's own data and
 * must never appear in Bitecodes' inbox.
 */
describeWithDatabase("booking lead capture", () => {
  useTestDatabase();

  const ORIGIN = "https://example.com";
  const NOW = new Date("2026-09-01T09:05:00.000Z");
  const SLOT = "2026-09-01T12:00:00.000Z";

  async function seedOwner(role: AdminRole): Promise<string> {
    const { adminUsers } = await import("@/lib/server/db/collections");
    const now = new Date();
    const inserted = await (
      await adminUsers()
    ).insertOne({
      email: `${role}-${new ObjectId().toHexString()}@example.com`,
      name: `${role} user`,
      role,
      passwordHash: "not-used",
      status: "active",
      createdAt: now,
      updatedAt: now,
    } as AdminUserDoc);
    return inserted.insertedId.toHexString();
  }

  async function seedConfig(ownerId: string): Promise<BookingConfigDoc> {
    const { bookingConfigs } = await import("@/lib/server/db/collections");
    const now = new Date();
    const config: BookingConfigDoc = {
      bookingId: `bk-${new ObjectId().toHexString()}`,
      ownerId,
      name: "Discovery call",
      description: null,
      status: "active",
      allowedDomains: ["example.com"],
      publicTokenHash: "hash",
      timezone: "UTC",
      slotMinutes: 30,
      leadTimeHours: 0,
      horizonDays: 7,
      availability: [1, 2, 3, 4, 5].map((day) => ({
        day: day as 1 | 2 | 3 | 4 | 5,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      })),
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
    };
    await (await bookingConfigs()).insertOne(config);
    return config;
  }

  async function fund(ownerId: string) {
    const { credit } = await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId,
      product: "bookings",
      amount: 5,
      kind: "purchase",
    });
  }

  beforeEach(async () => {
    const {
      adminUsers,
      bookingConfigs,
      bookings,
      contactEnquiries,
      emailMessages,
      jobs,
      rateLimits,
      siteSettings,
      walletBalances,
      walletLedger,
    } = await import("@/lib/server/db/collections");
    await (await adminUsers()).deleteMany({});
    await (await bookingConfigs()).deleteMany({});
    await (await bookings()).deleteMany({});
    await (await contactEnquiries()).deleteMany({});
    await (await emailMessages()).deleteMany({});
    await (await jobs()).deleteMany({});
    await (await rateLimits()).deleteMany({});
    await (await siteSettings()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
  });

  async function book(config: BookingConfigDoc, ip: string) {
    const { handleBooking } = await import("@/lib/server/bookings/book");
    return handleBooking({
      config,
      startIso: SLOT,
      customer: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+91 99999 99999",
        notes: "Interested in a website.",
      },
      origin: ORIGIN,
      ip,
      userAgent: "test",
      visitorTimezone: "Asia/Kolkata",
      now: NOW,
    });
  }

  it("captures a booking on a staff calendar as a lead", async () => {
    const ownerId = await seedOwner("owner");
    const config = await seedConfig(ownerId);
    await fund(ownerId);

    const outcome = await book(config, "203.0.113.40");
    expect(outcome.kind).toBe("ok");

    const { contactEnquiries } = await import("@/lib/server/db/collections");
    const leads = await (await contactEnquiries()).find({}).toArray();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      kind: "booking",
      source: "booking",
      email: "ada@example.com",
      name: "Ada Lovelace",
      phone: "+91 99999 99999",
      status: "new",
      consent: { contact: true, marketing: false },
    });
    expect(leads[0].message).toContain("Discovery call");
    expect(leads[0].detail).toMatchObject({
      configName: "Discovery call",
      timezone: "Asia/Kolkata",
      origin: ORIGIN,
    });
    if (outcome.kind === "ok") {
      expect(leads[0].detail).toMatchObject({ bookingId: outcome.bookingId });
    }
  });

  it("does not copy a self-serve customer's booking into our own CRM", async () => {
    const ownerId = await seedOwner("customer");
    const config = await seedConfig(ownerId);
    await fund(ownerId);

    const outcome = await book(config, "203.0.113.41");
    expect(outcome.kind).toBe("ok");

    const { contactEnquiries } = await import("@/lib/server/db/collections");
    expect(await (await contactEnquiries()).countDocuments({})).toBe(0);
  });
});
