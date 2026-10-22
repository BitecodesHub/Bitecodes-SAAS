import { describe, expect, it } from "vitest";
import { buildPaymentSchedule } from "@/lib/proposals/pricing";

/**
 * The payment schedule is a commercial commitment, so the arithmetic is tested
 * directly: percentages must sum to 100 and the amounts must sum to the total
 * exactly, for every milestone count the editor permits.
 */

describe("proposal payment schedule", () => {
  it("uses one final payment for a single milestone", () => {
    const schedule = buildPaymentSchedule(41_500, 1);
    expect(schedule).toEqual([
      { label: "Final payment on acceptance", percent: 100, amount: 41_500 },
    ]);
  });

  it("splits two milestones 50/50", () => {
    const schedule = buildPaymentSchedule(41_500, 2);
    expect(schedule.map((term) => term.percent)).toEqual([50, 50]);
    expect(schedule.map((term) => term.amount)).toEqual([20_750, 20_750]);
  });

  it("uses 40 percent plus a middle split from three milestones", () => {
    expect(
      buildPaymentSchedule(100_000, 3).map((term) => term.percent),
    ).toEqual([40, 30, 30]);
    expect(
      buildPaymentSchedule(100_000, 4).map((term) => term.percent),
    ).toEqual([40, 15, 15, 30]);
    expect(
      buildPaymentSchedule(100_000, 6).map((term) => term.percent),
    ).toEqual([40, 7, 7, 7, 7, 32]);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    "keeps percentages at 100 and the total exact for %i milestones",
    (count) => {
      for (const total of [0, 1, 41_500, 99_999, 1_240, 3_333_333]) {
        const schedule = buildPaymentSchedule(total, count);
        expect(schedule).toHaveLength(count);
        expect(schedule.reduce((sum, term) => sum + term.percent, 0)).toBe(100);
        expect(schedule.reduce((sum, term) => sum + term.amount, 0)).toBe(
          total,
        );
        expect(schedule.at(-1)?.amount).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it("clamps out-of-range milestone counts to the supported window", () => {
    expect(buildPaymentSchedule(1_000, 0)).toHaveLength(1);
    expect(buildPaymentSchedule(1_000, 99)).toHaveLength(6);
  });
});
