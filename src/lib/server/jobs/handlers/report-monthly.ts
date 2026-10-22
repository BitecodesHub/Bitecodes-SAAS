import "server-only";

import { z } from "zod";

import { getSettingsFresh } from "@/lib/server/settings";
import { queueEmail } from "@/lib/server/email/send";
import { isDeliverableEmail } from "@/lib/email/address";
import { getSiteUrl } from "@/lib/server/env";
import type { EmailBlock } from "@/lib/email/template";
import type { JobContext } from "@/lib/server/jobs/worker";
import {
  adminUsers,
  bookings,
  chatbots,
  customerReports,
  formSubmissions,
  walletLedger,
} from "@/lib/server/db/collections";
import type { AdminUserDoc, CustomerReportDoc } from "@/lib/server/db/types";

/**
 * `report.monthly` — Monthly usage reports for customers.
 *
 * Runs on the 1st of each month (hourUtc: 4) with `{ period }`, the month the
 * run belongs to. The report covers the **previous** calendar month: on
 * 1 November the customer receives October's figures, which is the only month
 * whose data is complete at that moment. All ranges are UTC, matching every
 * other report in the product.
 */
const payloadSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM.")
    .optional(),
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export async function handleMonthlyReports(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Invalid monthly report payload.");

  const settings = await getSettingsFresh();
  if (!settings.growth.monthlyCustomerReports) {
    context.log("Monthly customer reports are disabled in growth settings.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const runMonth = parsed.data.period
    ? monthStart(parsed.data.period)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(
    Date.UTC(runMonth.getUTCFullYear(), runMonth.getUTCMonth() - 1, 1),
  );
  const end = runMonth;
  const period = formatPeriod(start);
  const monthLabel = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;

  const reports = await customerReports();
  const customers = await (await adminUsers())
    .find({ role: "customer", status: "active" })
    .toArray();

  let reportsGenerated = 0;
  let reportsExisting = 0;
  let emailed = 0;
  let emailSkipped = 0;
  let emailFailed = 0;
  let stoppedAtDeadline = false;

  for (const customer of customers) {
    if (context.deadline && Date.now() > context.deadline - 5_000) {
      stoppedAtDeadline = true;
      context.log("Monthly reports past deadline, stopping.");
      break;
    }

    const ownerId = customer._id!.toHexString();
    const existingReport = await reports.findOne({ ownerId, period });
    const report =
      existingReport ?? (await createReport(ownerId, period, start, end, now));

    if (existingReport) reportsExisting += 1;
    else reportsGenerated += 1;

    if (report.emailedAt) continue;

    const outcome = await emailReport(customer, report, monthLabel, {
      start,
      end,
    });
    if (outcome.sent) {
      emailed += 1;
    } else if (outcome.reason === "skipped") {
      emailSkipped += 1;
      context.log(
        `Monthly report not sent to ${customer.email}: ${outcome.detail}`,
      );
    } else {
      emailFailed += 1;
      context.log(
        `Monthly report email failed for ${customer.email}: ${outcome.detail}`,
      );
    }
  }

  return {
    period,
    timezone: "UTC",
    month: monthLabel,
    totalCustomers: customers.length,
    reportsGenerated,
    reportsExisting,
    emailed,
    emailSkipped,
    emailFailed,
    stoppedAtDeadline,
  };
}

async function createReport(
  ownerId: string,
  period: string,
  start: Date,
  end: Date,
  now: Date,
): Promise<CustomerReportDoc> {
  const range = { $gte: start, $lt: end };
  const [activeChatbots, submissions, confirmedBookings, creditsUsed] =
    await Promise.all([
      chatbots().then((collection) =>
        collection.countDocuments({ ownerId, status: "active" }),
      ),
      formSubmissions().then((collection) =>
        collection.countDocuments({ ownerId, createdAt: range }),
      ),
      bookings().then((collection) =>
        collection.countDocuments({
          ownerId,
          status: "confirmed",
          createdAt: range,
        }),
      ),
      walletLedger().then(async (collection) => {
        const [row] = await collection
          .aggregate<{
            total: number;
          }>([
            { $match: { ownerId, kind: "deduct", createdAt: range } },
            { $group: { _id: null, total: { $sum: { $abs: "$delta" } } } },
          ])
          .toArray();
        return Math.round(row?.total ?? 0);
      }),
    ]);

  const metrics: Record<string, number> = {
    activeChatbots,
    formSubmissions: submissions,
    bookings: confirmedBookings,
    creditsUsed,
  };

  const insights: string[] = [];
  if (activeChatbots > 0) {
    insights.push(
      `${activeChatbots} assistant${activeChatbots === 1 ? "" : "s"} active.`,
    );
  }
  if (submissions > 0) {
    insights.push(
      `${submissions} form submission${submissions === 1 ? "" : "s"} received.`,
    );
  }
  if (confirmedBookings > 0) {
    insights.push(
      `${confirmedBookings} booking${confirmedBookings === 1 ? "" : "s"} confirmed.`,
    );
  }
  if (creditsUsed > 0) {
    insights.push(
      `${creditsUsed} credit${creditsUsed === 1 ? "" : "s"} used across metered products.`,
    );
  }
  if (insights.length === 0) {
    insights.push("No usage activity was recorded in this period.");
  }

  const report: Omit<CustomerReportDoc, "_id"> = {
    ownerId,
    period,
    metrics,
    insights,
    aiModel: null,
    emailedAt: null,
    emailMessageId: null,
    createdAt: now,
    updatedAt: now,
  };

  const collection = await customerReports();
  try {
    await collection.insertOne(report as CustomerReportDoc);
  } catch (error) {
    // A concurrent run won the unique (ownerId, period) index. Its report is
    // equivalent to this one; carry on with the stored copy rather than
    // failing the whole batch.
    const stored = await collection.findOne({ ownerId, period });
    if (!stored) throw error;
    return stored;
  }

  return report as CustomerReportDoc;
}

async function emailReport(
  customer: AdminUserDoc,
  report: CustomerReportDoc,
  monthLabel: string,
  range: { start: Date; end: Date },
): Promise<
  { sent: true } | { sent: false; reason: "skipped" | "failed"; detail: string }
> {
  if (!isDeliverableEmail(customer.email)) {
    return { sent: false, reason: "skipped", detail: "undeliverable address" };
  }

  const startLabel = range.start.toISOString().slice(0, 10);
  const endLabel = new Date(range.end.getTime() - 1).toISOString().slice(0, 10);

  const blocks: EmailBlock[] = [
    {
      type: "p",
      text: `Your usage for ${monthLabel} (${startLabel} to ${endLabel}, UTC).`,
    },
    {
      type: "ul",
      items: [
        `Active assistants: ${report.metrics.activeChatbots ?? 0}`,
        `Form submissions: ${report.metrics.formSubmissions ?? 0}`,
        `Confirmed bookings: ${report.metrics.bookings ?? 0}`,
        `Credits used: ${report.metrics.creditsUsed ?? 0}`,
      ],
    },
  ];
  if (report.insights.length > 0) {
    blocks.push({ type: "ul", items: report.insights });
  }
  blocks.push({
    type: "cta",
    label: "View your report",
    url: `${getSiteUrl()}/app/reports`,
  });

  try {
    const result = await queueEmail({
      to: customer.email,
      toName: customer.name,
      subject: `Your ${monthLabel} Bitecodes report`,
      blocks,
      category: "transactional",
      templateKey: "account.monthly-report",
      skipApproval: true,
      track: false,
    });

    if (result.status !== "queued") {
      return {
        sent: false,
        reason: "skipped",
        detail: result.skipReason ?? result.status,
      };
    }

    await (
      await customerReports()
    ).updateOne(
      { ownerId: report.ownerId, period: report.period },
      {
        $set: {
          emailedAt: new Date(),
          emailMessageId: result.messageId,
          updatedAt: new Date(),
        },
      },
    );
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** `YYYY-MM` → the first instant of that UTC month. */
function monthStart(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1));
}

function formatPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
