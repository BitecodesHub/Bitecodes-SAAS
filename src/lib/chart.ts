/**
 * Chart arithmetic: formatting, scales, ticks, and path building.
 *
 * Kept pure and separate from the components so the parts that are easy to get
 * quietly wrong — tick rounding, empty and single-point series, all-zero data —
 * are unit-tested rather than eyeballed once and trusted.
 */

/**
 * Compacts a number for a stat tile: 1,284 / 12.9K / 4.2M.
 *
 * Thousands are only compacted from 10,000 up. "1.3K" loses precision a reader
 * of a four-digit KPI actually wants, whereas "12.9K" is genuinely easier to
 * scan than "12,943".
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";

  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000_000) {
    return `${sign}${trimZero(magnitude / 1_000_000_000)}B`;
  }
  if (magnitude >= 1_000_000)
    return `${sign}${trimZero(magnitude / 1_000_000)}M`;
  if (magnitude >= 10_000) return `${sign}${trimZero(magnitude / 1_000)}K`;

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** One decimal, but no trailing ".0" — "4M" reads better than "4.0M". */
function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Signed percentage change, or null when there is no meaningful baseline. */
export function percentageChange(
  current: number,
  previous: number,
): number | null {
  // Growth from zero is undefined, not "infinite percent".
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatDelta(percentage: number | null): string {
  if (percentage === null) return "—";
  const rounded = Math.round(percentage * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * Chooses round axis ticks covering [0, max].
 *
 * Steps snap to 1, 2, 2.5, or 5 times a power of ten, so labels read
 * 0/1,000/2,000 rather than 0/1,333/2,666.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  // An all-zero series still needs an axis, or the chart renders with no frame.
  if (!Number.isFinite(max) || max <= 0) return [0, 1];

  const rawStep = max / Math.max(1, targetCount);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  const step =
    (normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10) * magnitude;

  if (!Number.isFinite(step) || step <= 0) return [0, 1];

  // Round the top *up* to a whole step. Deriving the last tick from the loop
  // condition instead would stop below `max` for some inputs (max 42, step 20
  // ended at 40), and the tallest data point would then render outside the plot
  // frame because the caller scales against the last tick.
  const top = Math.ceil(max / step) * step;
  const count = Math.round(top / step);

  return Array.from(
    { length: count + 1 },
    (_, index) =>
      // Multiply rather than accumulate: repeated addition of 0.1 drifts into
      // 0.30000000000000004 and leaks into the axis labels.
      Math.round(index * step * 1e6) / 1e6,
  );
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Maps series values into SVG coordinates.
 *
 * `yMax` comes from the ticks rather than the data so the top gridline is the
 * top of the plot and the highest point does not touch the frame.
 */
export function buildScale({
  count,
  yMax,
  width,
  height,
  padding,
}: {
  count: number;
  yMax: number;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}) {
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const safeMax = yMax > 0 ? yMax : 1;

  return {
    plotWidth,
    plotHeight,
    /** A single point sits in the middle rather than pinned to the left edge. */
    x: (index: number) =>
      count <= 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (count - 1)) * plotWidth,
    y: (value: number) =>
      padding.top + plotHeight - (Math.max(0, value) / safeMax) * plotHeight,
    baseline: padding.top + plotHeight,
  };
}

/** An SVG polyline path through the points. Empty string for no data. */
export function buildLinePath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    // A single point has no line; the caller draws just the marker.
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

/** Closes a line path down to the baseline to make an area fill. */
export function buildAreaPath(points: Point[], baseline: number): string {
  if (points.length < 2) return "";
  const first = points[0]!;
  const last = points.at(-1)!;
  return `${buildLinePath(points)} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

/**
 * Picks which points get a direct value label.
 *
 * Selective by design: a number on every point is unreadable and goes unread,
 * so this returns the endpoint plus the maximum — the two a reader looks for —
 * and drops the max when it is adjacent to the endpoint to avoid collision.
 */
export function labelledIndices(values: number[]): number[] {
  if (values.length === 0) return [];
  const lastIndex = values.length - 1;
  if (values.length <= 2) return [lastIndex];

  let maxIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index]! > values[maxIndex]!) maxIndex = index;
  }

  if (Math.abs(maxIndex - lastIndex) <= 1) return [lastIndex];
  return [maxIndex, lastIndex];
}
