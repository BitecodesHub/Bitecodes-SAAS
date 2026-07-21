import { describe, expect, it } from "vitest";
import {
  calculateProjectEstimate,
  estimateInputSchema,
  estimateSummary,
  formatInr,
  projectTypes,
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
