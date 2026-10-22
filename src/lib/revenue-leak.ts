import { z } from "zod";

/**
 * Revenue-leak arithmetic.
 *
 * The calculator is deliberately simple and transparent: the visitor enters
 * their own traffic, enquiry rate, close rate, and average value. The output is
 * arithmetic on those inputs, not a prediction. The "benchmark" is a stated
 * reference point, clearly labelled, rather than a claim about their industry.
 */

export const BENCHMARK_CONVERSION_RATE = 3;

export const revenueInputSchema = z
  .object({
    monthlyVisitors: z.number().min(100).max(10_000_000),
    conversionRate: z.number().min(0.1).max(25),
    closeRate: z.number().min(1).max(100),
    averageOrderValue: z.number().min(10).max(1_000_000),
  })
  .strict();

export type RevenueInput = z.infer<typeof revenueInputSchema>;

export interface RevenueScenario {
  /** Relative uplift applied to the enquiry rate, e.g. 0.25 for +25%. */
  uplift: number;
  extraLeads: number;
  extraCustomers: number;
  extraMonthlyRevenue: number;
  extraAnnualRevenue: number;
}

export interface RevenueResult {
  monthlyVisitors: number;
  conversionRate: number;
  closeRate: number;
  averageOrderValue: number;
  monthlyLeads: number;
  monthlyCustomers: number;
  monthlyRevenue: number;
  annualRevenue: number;
  benchmarkRate: number;
  benchmarkLeads: number;
  benchmarkRevenue: number;
  lostMonthlyLeads: number;
  lostMonthlyRevenue: number;
  lostAnnualRevenue: number;
  scenarios: RevenueScenario[];
  annualOpportunity: number;
}

const round = (value: number) => Math.round(value);
const money = (value: number) => Math.max(0, Math.round(value));

export function calculateRevenueLeak(input: RevenueInput): RevenueResult {
  const conversion = input.conversionRate / 100;
  const close = input.closeRate / 100;

  const monthlyLeads = input.monthlyVisitors * conversion;
  const monthlyCustomers = monthlyLeads * close;
  const monthlyRevenue = monthlyCustomers * input.averageOrderValue;

  const benchmark = Math.max(input.conversionRate, BENCHMARK_CONVERSION_RATE);
  const benchmarkLeads = input.monthlyVisitors * (benchmark / 100);
  const benchmarkRevenue = benchmarkLeads * close * input.averageOrderValue;

  const lostMonthlyLeads = Math.max(0, benchmarkLeads - monthlyLeads);
  const lostMonthlyRevenue = Math.max(0, benchmarkRevenue - monthlyRevenue);

  const scenarios: RevenueScenario[] = [0.25, 0.5, 1].map((uplift) => {
    const extraLeads = monthlyLeads * uplift;
    const extraCustomers = extraLeads * close;
    const extraMonthlyRevenue = extraCustomers * input.averageOrderValue;
    return {
      uplift,
      extraLeads: round(extraLeads),
      extraCustomers: round(extraCustomers),
      extraMonthlyRevenue: money(extraMonthlyRevenue),
      extraAnnualRevenue: money(extraMonthlyRevenue * 12),
    };
  });

  return {
    monthlyVisitors: input.monthlyVisitors,
    conversionRate: input.conversionRate,
    closeRate: input.closeRate,
    averageOrderValue: input.averageOrderValue,
    monthlyLeads: round(monthlyLeads),
    monthlyCustomers: round(monthlyCustomers),
    monthlyRevenue: money(monthlyRevenue),
    annualRevenue: money(monthlyRevenue * 12),
    benchmarkRate: benchmark,
    benchmarkLeads: round(benchmarkLeads),
    benchmarkRevenue: money(benchmarkRevenue),
    lostMonthlyLeads: round(lostMonthlyLeads),
    lostMonthlyRevenue: money(lostMonthlyRevenue),
    lostAnnualRevenue: money(lostMonthlyRevenue * 12),
    scenarios,
    annualOpportunity: money(lostMonthlyRevenue * 12),
  };
}

/** Formats whole dollars without cents, with a compact fallback for huge sums. */
export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Report-email payload, validated at the route boundary. */
export const revenueReportSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().max(100).optional(),
    input: revenueInputSchema,
    followUp: z.boolean().default(false),
    attribution: z.unknown().optional(),
    requestId: z.string().trim().min(8).max(64).optional(),
  })
  .strict();

export type RevenueReportInput = z.input<typeof revenueReportSchema>;

export const REVENUE_FOLLOW_UP_CONSENT_TEXT =
  "I agree that Bitecodes may contact me about this revenue estimate and how to improve conversion.";
