import { describe, expect, it } from "vitest";
import {
  buildAreaPath,
  buildLinePath,
  buildScale,
  formatCompact,
  formatDelta,
  labelledIndices,
  niceTicks,
  percentageChange,
} from "@/lib/chart";

describe("formatCompact", () => {
  it("leaves small numbers readable with separators", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(7)).toBe("7");
    expect(formatCompact(1_284)).toBe("1,284");
    expect(formatCompact(9_999)).toBe("9,999");
  });

  it("compacts from ten thousand upwards", () => {
    // Below 10K the exact figure is more useful than a lossy "1.3K".
    expect(formatCompact(10_000)).toBe("10K");
    expect(formatCompact(12_943)).toBe("12.9K");
    expect(formatCompact(999_000)).toBe("999K");
  });

  it("compacts millions and billions", () => {
    expect(formatCompact(4_200_000)).toBe("4.2M");
    expect(formatCompact(4_000_000)).toBe("4M");
    expect(formatCompact(1_500_000_000)).toBe("1.5B");
  });

  it("drops a trailing .0 rather than printing 4.0M", () => {
    expect(formatCompact(2_000_000)).toBe("2M");
    expect(formatCompact(30_000)).toBe("30K");
  });

  it("handles negatives", () => {
    expect(formatCompact(-1_284)).toBe("-1,284");
    expect(formatCompact(-4_200_000)).toBe("-4.2M");
  });

  it("degrades gracefully on non-finite input", () => {
    // A KPI computed from an empty collection can produce NaN; "—" is far
    // better than rendering "NaN" on a dashboard.
    expect(formatCompact(Number.NaN)).toBe("—");
    expect(formatCompact(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("percentageChange", () => {
  it("computes signed change", () => {
    expect(percentageChange(150, 100)).toBe(50);
    expect(percentageChange(50, 100)).toBe(-50);
    expect(percentageChange(100, 100)).toBe(0);
  });

  it("returns null when the baseline is zero", () => {
    // Growth from nothing is undefined, not "infinity percent".
    expect(percentageChange(10, 0)).toBeNull();
    expect(percentageChange(0, 0)).toBeNull();
  });

  it("uses the magnitude of a negative baseline", () => {
    expect(percentageChange(-50, -100)).toBe(50);
  });
});

describe("formatDelta", () => {
  it("signs and rounds", () => {
    expect(formatDelta(12.34)).toBe("+12.3%");
    expect(formatDelta(-8)).toBe("-8%");
    expect(formatDelta(0)).toBe("0%");
  });

  it("renders a missing baseline as an em dash", () => {
    expect(formatDelta(null)).toBe("—");
  });
});

describe("niceTicks", () => {
  it("produces round steps", () => {
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(2_400)).toEqual([0, 1000, 2000, 3000]);
  });

  it("rounds the top up to a whole step so the tallest point stays in frame", () => {
    // Regression: max 42 with a step of 20 used to stop at 40, putting the
    // highest data point above the plot area.
    expect(niceTicks(42).at(-1)).toBe(60);
    expect(niceTicks(101).at(-1)).toBeGreaterThanOrEqual(101);
  });

  it("always spans the data", () => {
    for (const max of [1, 3, 7, 42, 99, 1_001, 87_654]) {
      const ticks = niceTicks(max);
      expect(ticks.at(-1), `max=${max}`).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
    }
  });

  it("gives an all-zero series a usable axis", () => {
    // Without this the plot would have zero height and render as a bare line.
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(-5)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });

  it("does not leak floating-point noise into labels", () => {
    for (const max of [0.3, 0.7, 1.1, 2.2]) {
      for (const tick of niceTicks(max)) {
        expect(String(tick), `max=${max}`).not.toMatch(/00000|99999/);
      }
    }
  });

  it("ascends with no duplicates", () => {
    for (const max of [1, 13, 250, 9_999]) {
      const ticks = niceTicks(max);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
    }
  });
});

describe("buildScale", () => {
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };

  it("maps the first and last index to the plot edges", () => {
    const scale = buildScale({
      count: 5,
      yMax: 100,
      width: 230,
      height: 130,
      padding,
    });
    expect(scale.x(0)).toBe(30);
    expect(scale.x(4)).toBe(220);
  });

  it("maps zero to the baseline and the max to the top", () => {
    const scale = buildScale({
      count: 5,
      yMax: 100,
      width: 230,
      height: 130,
      padding,
    });
    expect(scale.y(0)).toBe(scale.baseline);
    expect(scale.y(100)).toBe(10);
    expect(scale.y(50)).toBe(60);
  });

  it("centres a single point instead of pinning it to the left edge", () => {
    const scale = buildScale({
      count: 1,
      yMax: 10,
      width: 230,
      height: 130,
      padding,
    });
    expect(scale.x(0)).toBe(30 + 190 / 2);
  });

  it("never divides by zero on an empty series", () => {
    const scale = buildScale({
      count: 0,
      yMax: 0,
      width: 230,
      height: 130,
      padding,
    });
    expect(Number.isFinite(scale.x(0))).toBe(true);
    expect(Number.isFinite(scale.y(0))).toBe(true);
  });

  it("clamps negative values to the baseline", () => {
    const scale = buildScale({
      count: 3,
      yMax: 100,
      width: 230,
      height: 130,
      padding,
    });
    expect(scale.y(-50)).toBe(scale.baseline);
  });

  it("survives a container smaller than its own padding", () => {
    const scale = buildScale({
      count: 3,
      yMax: 10,
      width: 10,
      height: 10,
      padding,
    });
    expect(scale.plotWidth).toBeGreaterThan(0);
    expect(scale.plotHeight).toBeGreaterThan(0);
  });
});

describe("buildLinePath", () => {
  it("builds a polyline", () => {
    expect(
      buildLinePath([
        { x: 0, y: 10 },
        { x: 5, y: 2 },
        { x: 10, y: 6 },
      ]),
    ).toBe("M 0 10 L 5 2 L 10 6");
  });

  it("returns an empty string for no points", () => {
    expect(buildLinePath([])).toBe("");
  });

  it("emits only a move for a single point", () => {
    expect(buildLinePath([{ x: 3, y: 4 }])).toBe("M 3 4");
  });
});

describe("buildAreaPath", () => {
  it("closes the path to the baseline", () => {
    expect(
      buildAreaPath(
        [
          { x: 0, y: 10 },
          { x: 10, y: 4 },
        ],
        50,
      ),
    ).toBe("M 0 10 L 10 4 L 10 50 L 0 50 Z");
  });

  it("declines to fill fewer than two points", () => {
    // A one-point area would render as a zero-width sliver.
    expect(buildAreaPath([{ x: 0, y: 1 }], 50)).toBe("");
    expect(buildAreaPath([], 50)).toBe("");
  });
});

describe("labelledIndices", () => {
  it("labels the endpoint and the maximum", () => {
    expect(labelledIndices([1, 9, 2, 3, 4])).toEqual([1, 4]);
  });

  it("labels only the endpoint when the max is adjacent to it", () => {
    // Two labels a few pixels apart collide and read as noise.
    expect(labelledIndices([1, 2, 3, 9, 4])).toEqual([4]);
    expect(labelledIndices([1, 2, 3, 4, 9])).toEqual([4]);
  });

  it("labels one point for very short series", () => {
    expect(labelledIndices([5])).toEqual([0]);
    expect(labelledIndices([5, 6])).toEqual([1]);
  });

  it("returns nothing for an empty series", () => {
    expect(labelledIndices([])).toEqual([]);
  });

  it("never labels more than two points", () => {
    // The whole value of direct labels is that they are sparing.
    for (const length of [3, 5, 12, 30, 90]) {
      const values = Array.from({ length }, (_, index) => (index * 7) % 13);
      expect(labelledIndices(values).length).toBeLessThanOrEqual(2);
    }
  });

  it("returns in-range, unique indices", () => {
    const values = [3, 1, 8, 2, 5, 0, 4];
    const indices = labelledIndices(values);
    expect(new Set(indices).size).toBe(indices.length);
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(values.length);
    }
  });
});
