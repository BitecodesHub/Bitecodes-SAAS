import { describe, expect, it } from "vitest";
import {
  BENCHMARK_CONVERSION_RATE,
  calculateRevenueLeak,
  formatMoney,
  revenueInputSchema,
  revenueReportSchema,
} from "@/lib/revenue-leak";

const base = {
  monthlyVisitors: 5_000,
  conversionRate: 1.5,
  closeRate: 25,
  averageOrderValue: 1_500,
};

describe("revenue leak calculator", () => {
  it("completes the funnel arithmetic", () => {
    const result = calculateRevenueLeak(base);
    expect(result.monthlyLeads).toBe(75);
    expect(result.monthlyCustomers).toBe(19);
    expect(result.monthlyRevenue).toBe(28_125);
    expect(result.annualRevenue).toBe(337_500);
  });

  it("compares against the stated benchmark without inventing a loss", () => {
    const result = calculateRevenueLeak(base);
    expect(result.benchmarkRate).toBe(BENCHMARK_CONVERSION_RATE);
    expect(result.lostMonthlyLeads).toBe(75);
    expect(result.lostMonthlyRevenue).toBe(28_125);
    expect(result.lostAnnualRevenue).toBe(337_500);
  });

  it("reports no lost revenue when the site is above the benchmark", () => {
    const result = calculateRevenueLeak({ ...base, conversionRate: 5 });
    expect(result.benchmarkRate).toBe(5);
    expect(result.lostMonthlyLeads).toBe(0);
    expect(result.lostMonthlyRevenue).toBe(0);
    expect(result.annualOpportunity).toBe(0);
  });

  it("prices three relative uplift scenarios", () => {
    const result = calculateRevenueLeak(base);
    expect(result.scenarios.map((scenario) => scenario.uplift)).toEqual([
      0.25, 0.5, 1,
    ]);
    const [quarter, half, full] = result.scenarios;
    expect(quarter.extraLeads).toBe(19);
    expect(half.extraLeads).toBe(38);
    expect(full.extraLeads).toBe(75);
    expect(full.extraAnnualRevenue).toBeGreaterThan(half.extraAnnualRevenue);
  });

  it("never returns negative values for absurd input", () => {
    const result = calculateRevenueLeak({
      monthlyVisitors: 100,
      conversionRate: 0.1,
      closeRate: 1,
      averageOrderValue: 10,
    });
    expect(result.lostMonthlyRevenue).toBeGreaterThanOrEqual(0);
    expect(result.annualOpportunity).toBeGreaterThanOrEqual(0);
  });

  it("validates inputs and rejects unknown fields", () => {
    expect(revenueInputSchema.safeParse(base).success).toBe(true);
    expect(revenueInputSchema.safeParse({ ...base, extra: true }).success).toBe(
      false,
    );
    expect(
      revenueInputSchema.safeParse({ ...base, monthlyVisitors: 0 }).success,
    ).toBe(false);
    expect(
      revenueInputSchema.safeParse({ ...base, conversionRate: 99 }).success,
    ).toBe(false);
  });

  it("validates the report payload", () => {
    expect(
      revenueReportSchema.safeParse({
        email: "buyer@example.com",
        input: base,
      }).success,
    ).toBe(true);
    expect(
      revenueReportSchema.safeParse({ email: "nope", input: base }).success,
    ).toBe(false);
  });

  it("formats whole dollars", () => {
    expect(formatMoney(337_500)).toBe("$337,500");
    expect(formatMoney(0)).toBe("$0");
  });
});
