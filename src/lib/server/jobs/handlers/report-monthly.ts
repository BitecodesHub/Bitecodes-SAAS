import "server-only";

import { getSettingsFresh } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";
import type { CustomerReportDoc } from "@/lib/server/db/types";

/**
 * `report.monthly` — Monthly usage reports for customers.
 *
 * Runs on the 1st of each month (hourUtc: 4). Returns { skipped: "disabled" }
 * when settings.growth.monthlyCustomerReports is off, stays idempotent, respects
 * context.deadline, and returns a small JSON summary.
 */
export async function handleMonthlyReports(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();

  if (!settings.growth.monthlyCustomerReports) {
    context.log("Monthly customer reports are disabled in growth settings.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const deadline = context.deadline;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const period = `${year}-${String(month + 1).padStart(2, "0")}`;

  // If we already generated a report for this month, skip (idempotent)
  const database = await (await import("@/lib/server/mongodb")).getDatabase();
  const customerReportsCollection =
    database.collection<CustomerReportDoc>("customer_reports");

  const existingReport = await customerReportsCollection.findOne({
    ownerId: "system",
    period,
  });

  if (existingReport) {
    context.log(`Monthly report for ${period} already generated.`);
    return { skipped: "already-generated", period };
  }

  let totalCustomers = 0;
  let reportsGenerated = 0;
  const generatedPeriods: string[] = [];

  // Get all customer accounts
  const customers = await database
    .collection("admin_users")
    .find({ role: "customer" })
    .toArray();

  totalCustomers = customers.length;

  const reportCreatedAt = new Date(Date.UTC(year, month, 1));

  for (const customer of customers) {
    if (deadline && Date.now() > deadline - 5_000) {
      context.log("Monthly reports past deadline, stopping.");
      break;
    }

    // Compute simple metrics from associated data
    // Chatbots count
    const chatbots = await database
      .collection("chatbot_configs")
      .countDocuments({ ownerId: customer._id });

    // Forms count
    const forms = await database
      .collection("form_submissions")
      .countDocuments({ ownerId: customer._id });

    // Bookings count
    const bookings = await database
      .collection("booking_configs")
      .countDocuments({ ownerId: customer._id });

    // Email submissions count
    const emailSubs = await database
      .collection("email_submissions")
      .countDocuments({ ownerId: customer._id });

    const metrics: Record<string, number> = {
      chatbots,
      forms,
      bookings,
      emailSubmissions: emailSubs,
    };

    const insights: string[] = [];
    if (chatbots > 0) insights.push(`${chatbots} chatbot(s) active`);
    if (forms > 0) insights.push(`${forms} form(s) submitted`);
    if (bookings > 0) insights.push(`${bookings} booking(s) scheduled`);
    if (emailSubs > 0) insights.push(`${emailSubs} email submission(s)`);

    // Store the customer report
    const reportDoc: CustomerReportDoc = {
      _id: undefined,
      ownerId: customer._id.toString(),
      period,
      metrics,
      insights,
      aiModel: null,
      emailedAt: null,
      emailMessageId: null,
      createdAt: reportCreatedAt,
      updatedAt: reportCreatedAt,
    };

    await customerReportsCollection.insertOne(reportDoc);
    reportsGenerated += 1;
    generatedPeriods.push(period);
  }

  return {
    totalCustomers,
    reportsGenerated,
    period,
    generatedPeriods,
  };
}
