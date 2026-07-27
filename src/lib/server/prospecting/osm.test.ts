import { describe, expect, it } from "vitest";
import {
  radiusFromBoundingBox,
  readCountTotal,
} from "@/lib/server/prospecting/osm";

describe("radiusFromBoundingBox", () => {
  it("derives a neighbourhood-scale radius", () => {
    // Roughly 2 km x 2 km around Navrangpura, Ahmedabad.
    const radius = radiusFromBoundingBox([
      "23.0200",
      "23.0380",
      "72.5500",
      "72.5700",
    ]);
    expect(radius).toBeGreaterThan(1_000);
    expect(radius).toBeLessThan(2_000);
  });

  it("derives a city-scale radius", () => {
    const radius = radiusFromBoundingBox([
      "22.9000",
      "23.1500",
      "72.4000",
      "72.7000",
    ]);
    expect(radius).toBeGreaterThan(15_000 - 1);
  });

  it("clamps a country-sized box to something searchable", () => {
    // A 500 km radius would be refused by Overpass and is useless for outreach.
    expect(radiusFromBoundingBox(["8.0", "37.0", "68.0", "97.0"])).toBe(15_000);
  });

  it("uses the neighbourhood default for a point-like result", () => {
    // A single shop or landmark has a zero-area box. Suggesting the 300 m floor
    // would return almost nothing, so the 2 km default is the useful answer.
    expect(
      radiusFromBoundingBox(["23.0225", "23.0225", "72.5714", "72.5714"]),
    ).toBe(2_000);
  });

  it("still honours the 300 m floor for a very small but real box", () => {
    // ~90 m tall: real, tiny, and should not be rounded down to nothing.
    expect(
      radiusFromBoundingBox(["23.0225", "23.0233", "72.5714", "72.5714"]),
    ).toBe(300);
  });

  it("narrows longitude by latitude, so a polar box is not overstated", () => {
    // The same degree span covers far less ground near the pole.
    const equator = radiusFromBoundingBox(["0.0", "0.1", "0.0", "0.1"]);
    const arctic = radiusFromBoundingBox(["79.0", "79.1", "0.0", "0.1"]);
    expect(arctic).toBeLessThan(equator);
  });

  it("falls back to the default for missing or malformed input", () => {
    expect(radiusFromBoundingBox(undefined)).toBe(2_000);
    expect(radiusFromBoundingBox(["1", "2"])).toBe(2_000);
    expect(radiusFromBoundingBox(["a", "b", "c", "d"])).toBe(2_000);
  });
});

describe("readCountTotal", () => {
  it("prefers the explicit total", () => {
    expect(
      readCountTotal({ elements: [{ tags: { total: "42", nodes: "1" } }] }),
    ).toBe(42);
  });

  it("sums element types when no total is given", () => {
    expect(
      readCountTotal({
        elements: [{ tags: { nodes: "10", ways: "5", relations: "2" } }],
      }),
    ).toBe(17);
  });

  it("treats a zero total as zero, not as missing", () => {
    expect(readCountTotal({ elements: [{ tags: { total: "0" } }] })).toBe(0);
  });

  it("returns zero for an empty or malformed response", () => {
    expect(readCountTotal({})).toBe(0);
    expect(readCountTotal({ elements: [] })).toBe(0);
    expect(readCountTotal({ elements: [{}] })).toBe(0);
    expect(readCountTotal({ elements: [{ tags: { nodes: "x" } }] })).toBe(0);
  });
});
