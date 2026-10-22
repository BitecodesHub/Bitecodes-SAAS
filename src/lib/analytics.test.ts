import { expect, it } from "vitest";
import {
  WEB_VITAL_THRESHOLDS,
  formatVital,
  isWebVitalName,
  percentile75,
  vitalRating,
} from "@/lib/analytics";

it("rates Web Vitals at the published boundaries", () => {
  expect(vitalRating("LCP", 2_500)).toBe("good");
  expect(vitalRating("LCP", 2_501)).toBe("needs-improvement");
  expect(vitalRating("LCP", 4_000)).toBe("needs-improvement");
  expect(vitalRating("LCP", 4_001)).toBe("poor");

  expect(vitalRating("INP", 200)).toBe("good");
  expect(vitalRating("INP", 500)).toBe("needs-improvement");
  expect(vitalRating("INP", 501)).toBe("poor");

  expect(vitalRating("CLS", 0.1)).toBe("good");
  expect(vitalRating("CLS", 0.25)).toBe("needs-improvement");
  expect(vitalRating("CLS", 0.26)).toBe("poor");

  expect(vitalRating("FCP", 1_800)).toBe("good");
  expect(vitalRating("TTFB", 801)).toBe("needs-improvement");
});

it("computes the 75th percentile by nearest rank", () => {
  expect(percentile75([])).toBeNull();
  expect(percentile75([10])).toBe(10);
  expect(percentile75([4, 1, 3, 2])).toBe(3);
  expect(percentile75([8, 7, 6, 5, 4, 3, 2, 1])).toBe(6);
  expect(percentile75([100, 200, 300, 400, 500])).toBe(400);
});

it("formats milliseconds and unitless layout shift distinctly", () => {
  expect(formatVital("LCP", 2_345.6)).toBe("2,346 ms");
  expect(formatVital("CLS", 0.123)).toBe("0.12");
});

it("knows the metric vocabulary", () => {
  expect(isWebVitalName("INP")).toBe(true);
  expect(isWebVitalName("FID")).toBe(false);
  expect(Object.keys(WEB_VITAL_THRESHOLDS)).toEqual([
    "LCP",
    "INP",
    "CLS",
    "FCP",
    "TTFB",
  ]);
});
