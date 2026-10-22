import { beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { createTestUser } from "@/test/desktop";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/server/email/send", () => ({
  queueEmail: vi.fn(),
}));

function context(deadline = Date.now() + 60_000) {
  return { jobId: "job-1", attempts: 1, deadline, log: vi.fn() };
}

async function database() {
  const { getDatabase } = await import("@/lib/server/mongodb");
  return getDatabase();
}

describeWithDatabase("monthly customer reports", () => {
  useTestDatabase();

  beforeEach(async () => {
    const db = await database();
    for (const name of [
      "admin_users",
      "chatbots",
      "form_submissions",
      "bookings",
      "wallet_ledger",
      "customer_reports",
      "site_settings",
    ]) {
      await db.collection(name).deleteMany({});
    }
    const { updateSettings } = await import("@/lib/server/settings");
    await updateSettings({ growth: { monthlyCustomerReports: true } });

    const { queueEmail } = await import("@/lib/server/email/send");
    vi.mocked(queueEmail).mockReset().mockResolvedValue({
      messageId: "message-1",
      status: "queued",
      skipReason: null,
      detail: null,
    });
  });

  it("reports the month before the scheduled period, using period-scoped counts", async () => {
    const ownerId = await createTestUser("customer", "customer@example.com");
    // An inactive customer must not receive a report.
    const disabledId = await createTestUser("customer", "gone@example.com");
    const db = await database();
    await db
      .collection("admin_users")
      .updateOne(
        { email: "gone@example.com" },
        { $set: { status: "disabled" } },
      );

    const inMonth = new Date("2026-10-15T12:00:00Z");
    const before = new Date("2026-09-15T12:00:00Z");
    const after = new Date("2026-11-02T12:00:00Z");

    await db.collection("chatbots").insertMany([
      { ownerId, chatbotId: "bot-1", publicTokenHash: "h1", status: "active" },
      { ownerId, chatbotId: "bot-2", publicTokenHash: "h2", status: "paused" },
    ]);
    await db.collection("form_submissions").insertMany([
      { ownerId, submissionId: "sub-1", createdAt: inMonth },
      { ownerId, submissionId: "sub-2", createdAt: before },
      { ownerId, submissionId: "sub-3", createdAt: after },
    ]);
    await db.collection("bookings").insertMany([
      {
        ownerId,
        bookingId: "book-1",
        configId: "config-1",
        startAt: inMonth,
        status: "confirmed",
        createdAt: inMonth,
      },
      {
        ownerId,
        bookingId: "book-2",
        configId: "config-1",
        startAt: new Date("2026-10-16T12:00:00Z"),
        status: "cancelled",
        createdAt: inMonth,
      },
      {
        ownerId,
        bookingId: "book-3",
        configId: "config-2",
        startAt: after,
        status: "confirmed",
        createdAt: after,
      },
    ]);
    await db.collection("wallet_ledger").insertMany([
      { ownerId, kind: "deduct", delta: -40, createdAt: inMonth },
      { ownerId, kind: "deduct", delta: -10, createdAt: before },
      { ownerId, kind: "purchase", delta: 100, createdAt: inMonth },
    ]);

    const { handleMonthlyReports } =
      await import("@/lib/server/jobs/handlers/report-monthly");
    const result = await handleMonthlyReports({ period: "2026-11" }, context());

    expect(result).toMatchObject({
      period: "2026-10",
      timezone: "UTC",
      totalCustomers: 1,
      reportsGenerated: 1,
      emailed: 1,
      emailFailed: 0,
    });

    const report = await db
      .collection("customer_reports")
      .findOne({ ownerId, period: "2026-10" });
    expect(report).toMatchObject({
      metrics: {
        activeChatbots: 1,
        formSubmissions: 1,
        bookings: 1,
        creditsUsed: 40,
      },
    });
    expect(report?.emailedAt).toBeInstanceOf(Date);
    expect(report?.emailMessageId).toBe("message-1");
    expect(disabledId).not.toBe(ownerId);

    const { queueEmail } = await import("@/lib/server/email/send");
    expect(queueEmail).toHaveBeenCalledTimes(1);
    expect(queueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "Your October 2026 Bitecodes report",
        category: "transactional",
        skipApproval: true,
      }),
    );
  });

  it("is idempotent: a retry reuses the report and does not email twice", async () => {
    const ownerId = await createTestUser("customer", "customer@example.com");

    const { handleMonthlyReports } =
      await import("@/lib/server/jobs/handlers/report-monthly");
    const first = await handleMonthlyReports({ period: "2026-11" }, context());
    const second = await handleMonthlyReports({ period: "2026-11" }, context());

    expect(first.reportsGenerated).toBe(1);
    expect(second).toMatchObject({
      reportsGenerated: 0,
      reportsExisting: 1,
      emailed: 0,
    });

    const db = await database();
    expect(
      await db.collection("customer_reports").countDocuments({ ownerId }),
    ).toBe(1);
    const { queueEmail } = await import("@/lib/server/email/send");
    expect(queueEmail).toHaveBeenCalledTimes(1);
  });

  it("returns disabled without writing reports when the toggle is off", async () => {
    const { updateSettings } = await import("@/lib/server/settings");
    await updateSettings({ growth: { monthlyCustomerReports: false } });
    await createTestUser("customer", "customer@example.com");

    const { handleMonthlyReports } =
      await import("@/lib/server/jobs/handlers/report-monthly");
    expect(
      await handleMonthlyReports({ period: "2026-11" }, context()),
    ).toEqual({ skipped: "disabled" });

    const db = await database();
    expect(await db.collection("customer_reports").countDocuments({})).toBe(0);
  });
});
