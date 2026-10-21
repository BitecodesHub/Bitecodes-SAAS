/**
 * Web Vitals vocabulary shared by the collector, the roll-up, the admin
 * dashboard, and the browser beacon.
 *
 * Kept client-safe so the beacon can decide which metric names to report from
 * the same list the server validates against. The thresholds are the published
 * Web Vitals boundaries: a value at or below `good` is good, at or below
 * `poor` needs improvement, and anything above `poor` is poor.
 */

export const WEB_VITAL_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;

export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];

export type VitalRating = "good" | "needs-improvement" | "poor";

export interface VitalThreshold {
  /** At or below this value the metric is good. */
  good: number;
  /** Above this value the metric is poor; between the two it needs work. */
  poor: number;
  unit: "ms" | "score";
  label: string;
}

export const WEB_VITAL_THRESHOLDS: Record<WebVitalName, VitalThreshold> = {
  LCP: {
    good: 2_500,
    poor: 4_000,
    unit: "ms",
    label: "Largest Contentful Paint",
  },
  INP: { good: 200, poor: 500, unit: "ms", label: "Interaction to Next Paint" },
  CLS: {
    good: 0.1,
    poor: 0.25,
    unit: "score",
    label: "Cumulative Layout Shift",
  },
  FCP: {
    good: 1_800,
    poor: 3_000,
    unit: "ms",
    label: "First Contentful Paint",
  },
  TTFB: { good: 800, poor: 1_800, unit: "ms", label: "Time to First Byte" },
};

export function isWebVitalName(value: string): value is WebVitalName {
  return (WEB_VITAL_NAMES as readonly string[]).includes(value);
}

export function vitalRating(metric: WebVitalName, value: number): VitalRating {
  const threshold = WEB_VITAL_THRESHOLDS[metric];
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/** Formats a metric for display: CLS has no unit, the rest are milliseconds. */
export function formatVital(metric: WebVitalName, value: number): string {
  if (metric === "CLS") return value.toFixed(2);
  return `${Math.round(value).toLocaleString("en-US")} ms`;
}

/**
 * The 75th percentile using the nearest-rank method, which is what the Web
 * Vitals field data reports. Returns null for an empty sample so a missing
 * metric is never rendered as zero.
 */
export function percentile75(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(sorted.length * 0.75);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? null;
}
