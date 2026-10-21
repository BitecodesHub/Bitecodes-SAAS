import { describe, expect, it } from "vitest";
import { SERVICE_PRICING } from "@/lib/pricing";
import {
  calculateProjectEstimate,
  estimateInputSchema,
  estimateSummary,
  formatInr,
  projectTypes,
  publishedFloorInr,
  type EstimateInput,
} from "@/lib/cost-estimator";

const baseInput: EstimateInput = {
  projectType: "saas-mvp",
  complexity: "growth",
  platforms: 1,
  features: ["custom-design", "authentication", "admin"],
  urgency: "standard",
  support: "quarter",
};

describe("project cost estimator", () => {
  it.each(projectTypes)("returns a valid range for $label", (project) => {
    const estimate = calculateProjectEstimate({
      ...baseInput,
      projectType: project.value,
    });

    expect(estimate.minimum).toBeGreaterThan(0);
    expect(estimate.maximum).toBeGreaterThan(estimate.minimum);
    expect(estimate.timelineMaxWeeks).toBeGreaterThan(
      estimate.timelineMinWeeks,
    );
  });

  it("increases the estimate for advanced scope and extra platforms", () => {
    const baseline = calculateProjectEstimate(baseInput);
    const expanded = calculateProjectEstimate({
      ...baseInput,
      complexity: "advanced",
      platforms: 3,
      urgency: "priority",
      support: "annual",
      features: [
        "custom-design",
        "authentication",
        "payments",
        "admin",
        "integrations",
        "realtime",
        "ai",
        "migration",
      ],
    });

    expect(expanded.minimum).toBeGreaterThan(baseline.minimum);
    expect(expanded.maximum).toBeGreaterThan(baseline.maximum);
  });

  it("never quotes below the published service floor", () => {
    for (const project of projectTypes) {
      const estimate = calculateProjectEstimate({
        ...baseInput,
        projectType: project.value,
        complexity: "essential",
        platforms: 1,
        features: [],
      });
      const floor = publishedFloorInr(project.value);
      expect(floor).toBeGreaterThan(0);
      expect(estimate.minimum).toBeGreaterThanOrEqual(floor);
      expect(estimate.maximum).toBeGreaterThan(estimate.minimum);
    }
  });

  it("lifts the collapsed business-website estimate to the INR floor", () => {
    const estimate = calculateProjectEstimate({
      ...baseInput,
      projectType: "business-website",
      complexity: "essential",
      platforms: 1,
      features: [],
      urgency: "standard",
      support: "launch",
    });

    expect(publishedFloorInr("business-website")).toBe(41_500);
    expect(estimate.minimum).toBe(41_500);
    expect(estimate.maximum).toBeGreaterThan(41_500);
  });

  it("keeps the consulting rate aligned with senior positioning", () => {
    const consulting = SERVICE_PRICING.find(
      (item) => item.slug === "technical-consulting",
    );
    expect(consulting?.unit).toBe("hour");
    expect(consulting?.startingFromUSD).toBe(60);
  });

  it("rejects invalid platform and feature values", () => {
    expect(
      estimateInputSchema.safeParse({ ...baseInput, platforms: 0 }).success,
    ).toBe(false);
    expect(
      estimateInputSchema.safeParse({
        ...baseInput,
        features: ["unknown-feature"],
      }).success,
    ).toBe(false);
  });

  it("formats INR and produces a contact-ready summary", () => {
    const estimate = calculateProjectEstimate(baseInput);
    expect(formatInr(estimate.minimum)).toContain("₹");
    expect(estimateSummary(baseInput, estimate)).toContain(
      "SaaS or startup MVP",
    );
  });
});
