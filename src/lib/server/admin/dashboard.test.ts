import { describe, expect, it } from "vitest";
import { buildDailySeries } from "@/lib/server/admin/dashboard";

describe("buildDailySeries", () => {
  const from = new Date("2026-07-01T13:45:00.000Z");
  const to = new Date("2026-07-05T09:15:00.000Z");

  it("emits one entry per day inclusive of both ends", () => {
    const series = buildDailySeries([], from, to);
    expect(series.labels).toEqual([
      "07-01",
      "07-02",
      "07-03",
      "07-04",
      "07-05",
    ]);
    expect(series.values).toEqual([0, 0, 0, 0, 0]);
  });

  it("fills gaps with zero rather than compressing them", () => {
    // MongoDB only returns days that have data. Charting the rows directly would
    // make three scattered leads look like three consecutive days.
    const series = buildDailySeries(
      [
        { _id: "2026-07-01", count: 2 },
        { _id: "2026-07-05", count: 3 },
      ],
      from,
      to,
    );
    expect(series.values).toEqual([2, 0, 0, 0, 3]);
    expect(series.labels).toHaveLength(series.values.length);
  });

  it("ignores rows outside the window", () => {
    const series = buildDailySeries(
      [
        { _id: "2026-06-30", count: 9 },
        { _id: "2026-07-03", count: 1 },
        { _id: "2026-07-09", count: 9 },
      ],
      from,
      to,
    );
    expect(series.values).toEqual([0, 0, 1, 0, 0]);
  });

  it("handles a single-day window", () => {
    const day = new Date("2026-07-01T00:00:00.000Z");
    const series = buildDailySeries(
      [{ _id: "2026-07-01", count: 4 }],
      day,
      day,
    );
    expect(series.labels).toEqual(["07-01"]);
    expect(series.values).toEqual([4]);
  });

  it("uses UTC boundaries, so a late-evening timestamp is not misfiled", () => {
    // A local-time bucket would push 23:30 UTC into the next or previous day
    // depending on the server's timezone.
    const late = new Date("2026-07-01T23:30:00.000Z");
    const series = buildDailySeries(
      [{ _id: "2026-07-01", count: 1 }],
      late,
      late,
    );
    expect(series.labels).toEqual(["07-01"]);
    expect(series.values).toEqual([1]);
  });

  it("spans a month boundary", () => {
    const series = buildDailySeries(
      [{ _id: "2026-08-01", count: 5 }],
      new Date("2026-07-30T10:00:00.000Z"),
      new Date("2026-08-02T10:00:00.000Z"),
    );
    expect(series.labels).toEqual(["07-30", "07-31", "08-01", "08-02"]);
    expect(series.values).toEqual([0, 0, 5, 0]);
  });

  it("spans a year boundary", () => {
    const series = buildDailySeries(
      [],
      new Date("2026-12-30T10:00:00.000Z"),
      new Date("2027-01-02T10:00:00.000Z"),
    );
    expect(series.labels).toEqual(["12-30", "12-31", "01-01", "01-02"]);
  });

  it("spans a 30-day window with the expected length", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const end = new Date("2026-07-30T23:59:00.000Z");
    expect(buildDailySeries([], start, end).values).toHaveLength(30);
  });

  it("returns empty when the range is inverted", () => {
    // Guards against a caller passing the dates the wrong way round and getting
    // an unbounded loop.
    expect(buildDailySeries([], to, from).labels).toEqual([]);
  });
});
