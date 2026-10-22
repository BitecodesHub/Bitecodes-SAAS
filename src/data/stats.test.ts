import { describe, expect, it } from "vitest";
import {
  liveProducts,
  liveProjectSites,
  stats,
  yearsSinceFounding,
} from "@/data/stats";
import { projects } from "@/data/projects";
import { siteConfig } from "@/lib/site";

describe("stats", () => {
  it("derives the founding-year figure from siteConfig", () => {
    expect(yearsSinceFounding).toBe(
      Math.max(0, new Date().getFullYear() - siteConfig.founded),
    );
  });

  it("counts only published, non-internal project sites", () => {
    expect(liveProjectSites).toEqual(
      projects.filter(
        (project) =>
          project.relationship !== "internal" && Boolean(project.liveUrl),
      ),
    );
    expect(
      liveProjectSites.every((project) => project.relationship !== "internal"),
    ).toBe(true);
  });

  it("derives every published number from data", () => {
    expect(stats).toEqual([
      { label: "Years since founding", value: yearsSinceFounding },
      { label: "Case studies published", value: projects.length },
      { label: "Products live", value: liveProducts.length },
      { label: "Markets served", value: siteConfig.markets.length },
    ]);
    expect(liveProducts.every((product) => product.href.startsWith("/"))).toBe(
      true,
    );
  });
});
