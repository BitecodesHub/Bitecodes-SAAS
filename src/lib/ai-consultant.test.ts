import { describe, expect, it } from "vitest";
import {
  consultantInputSchema,
  consultantJsonSchema,
  consultantRecommendationSchema,
  consultantSummary,
  type ConsultantRecommendation,
} from "@/lib/ai-consultant";

const input = {
  projectType: "saas",
  stage: "idea",
  goals:
    "Create a subscription workflow that helps operations teams manage client approvals.",
  audience: "Operations managers at service businesses",
  mustHaveFeatures: "Accounts, subscriptions, approvals, admin dashboard",
  budget: "5-15-lakh",
  timeline: "4-8-months",
} as const;

const recommendation: ConsultantRecommendation = {
  summary:
    "A focused SaaS MVP should validate the approval workflow before broader automation.",
  recommendedPackage: "Growth" as const,
  recommendedServices: ["SaaS Development", "UI/UX Development"],
  scope: ["Account access", "Approval workflow", "Admin operations"],
  technologyStack: ["Next.js", "Node.js", "MongoDB"],
  team: ["Product designer", "Full-stack engineer", "QA engineer"],
  addOns: ["AI-assisted replies"],
  assumptions: ["One web platform", "No regulated data"],
  clarifyingQuestions: ["Which approval roles are required?"],
  nextStep:
    "Run a focused discovery workshop to confirm workflows and integrations.",
};

describe("AI consultant contracts", () => {
  it("validates bounded project input", () => {
    expect(consultantInputSchema.safeParse(input).success).toBe(true);
    expect(
      consultantInputSchema.safeParse({ ...input, goals: "Too short" }).success,
    ).toBe(false);
    expect(
      consultantInputSchema.safeParse({ ...input, overridePrompt: true })
        .success,
    ).toBe(false);
  });

  it("validates bounded recommendation fields", () => {
    expect(
      consultantRecommendationSchema.safeParse(recommendation).success,
    ).toBe(true);
    expect(
      consultantRecommendationSchema.safeParse({
        ...recommendation,
        scope: [],
      }).success,
    ).toBe(false);
  });

  it("keeps the response schema strict and excludes quote authority", () => {
    expect(consultantJsonSchema.additionalProperties).toBe(false);
    expect(consultantJsonSchema.required).not.toContain("estimatedCostInr");
    expect(consultantJsonSchema.required).not.toContain(
      "estimatedTimelineWeeks",
    );
  });

  it("creates a concise contact handoff from a deterministic quote", () => {
    const summary = consultantSummary(recommendation, {
      minimum: 700000,
      maximum: 1200000,
      timelineMinWeeks: 14,
      timelineMaxWeeks: 20,
      teamSize: "3–5 specialists",
      projectLabel: "SaaS or startup MVP",
      assumptions: [],
    });
    expect(summary).toContain("Growth recommendation");
    expect(summary).toContain("₹7,00,000–₹12,00,000");
  });
});
