import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { captureLead } from "@/lib/server/leads/capture";
import { notifyNewLead } from "@/lib/server/email/notify";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import {
  REVENUE_FOLLOW_UP_CONSENT_TEXT,
  calculateRevenueLeak,
  formatMoney,
  revenueReportSchema,
} from "@/lib/revenue-leak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`revenue-report:${candidate}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "The request is too large." }, 413);
  }

  const limit = await consumeRateLimit({
    bucket: "revenue-report",
    key: clientKey(request),
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return json(
      { ok: false, message: "Too many report emails. Please try again later." },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Send a valid email address." }, 400);
  }

  const parsed = revenueReportSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, message: "Enter a valid email address and try again." },
      400,
    );
  }

  const input = parsed.data;
  const result = calculateRevenueLeak(input.input);

  try {
    const lead = await captureLead(
      {
        kind: "magnet",
        source: "revenue-leak-calculator",
        email: input.email,
        name: input.name,
        message: `Requested the revenue leak estimate (${formatMoney(result.annualOpportunity)} annual opportunity).`,
        consent: {
          contact: input.followUp,
          marketing: false,
          text: input.followUp ? REVENUE_FOLLOW_UP_CONSENT_TEXT : null,
        },
        attribution: input.attribution,
        detail: {
          inputs: input.input,
          monthlyRevenue: result.monthlyRevenue,
          annualOpportunity: result.annualOpportunity,
          followUp: input.followUp,
        },
        requestId: input.requestId ?? randomUUID(),
      },
      new Date(),
    );

    if (lead.created) {
      await notifyNewLead({
        leadId: lead.id,
        reference: lead.reference,
        source: "revenue-leak-calculator",
        kindLabel: "revenue estimate request",
        name: input.name,
        email: input.email,
        message: `Estimated ${formatMoney(result.annualOpportunity)}/year in conversion opportunity.`,
        score: null,
      }).catch(() => undefined);
    }

    const queued = await queueEmail({
      to: input.email,
      toName: input.name,
      subject: "Your website revenue estimate",
      blocks: [
        {
          type: "p",
          text: "Here is the estimate you built with the Bitecodes revenue leak calculator.",
        },
        {
          type: "ul",
          items: [
            `Monthly visitors: ${result.monthlyVisitors.toLocaleString("en-US")}.`,
            `Enquiry rate: ${result.conversionRate}%.`,
            `Close rate: ${result.closeRate}%.`,
            `Average customer value: ${formatMoney(result.averageOrderValue)}.`,
            `Estimated current revenue: ${formatMoney(result.monthlyRevenue)} per month, ${formatMoney(result.annualRevenue)} per year.`,
            `Estimated annual opportunity at a ${result.benchmarkRate}% enquiry rate: ${formatMoney(result.annualOpportunity)}.`,
          ],
        },
        {
          type: "p",
          text: "These figures are arithmetic on the assumptions you entered, not a forecast. A conversion improvement depends on the offer, traffic quality, and the changes made.",
        },
        {
          type: "h2",
          text: "What improving the enquiry rate would be worth",
        },
        {
          type: "ul",
          items: result.scenarios.map(
            (scenario) =>
              `+${Math.round(scenario.uplift * 100)}%: ${scenario.extraLeads} extra enquiries, ${scenario.extraCustomers} extra customers, ${formatMoney(scenario.extraAnnualRevenue)} extra per year.`,
          ),
        },
        {
          type: "cta",
          label: "Book a free 30-minute review",
          url: `${getSiteUrl()}/book-a-call`,
        },
      ],
      category: "transactional",
      skipApproval: true,
      track: false,
      leadId: lead.id,
      footerNote:
        "You asked for this estimate from the Bitecodes revenue leak calculator. Reply to this message if you would like the assumptions reviewed.",
    });

    if (queued.status === "skipped") {
      return json(
        {
          ok: false,
          message:
            "That address cannot receive the report. Please try a different address.",
        },
        400,
      );
    }

    return json({ ok: true, reference: lead.reference }, 200);
  } catch (error) {
    console.error(
      "[revenue-report] Could not store or queue the report:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return json(
      {
        ok: false,
        message:
          "The estimate could not be emailed right now. Please try again.",
      },
      502,
    );
  }
}
