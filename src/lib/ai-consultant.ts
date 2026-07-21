import { z } from "zod";
import type { ProjectEstimate } from "@/lib/cost-estimator";

export const consultantServiceNames = [
  "Website Development",
  "Web Applications",
  "Enterprise Software",
  "SaaS Development",
  "Custom Software",
  "REST API Development",
  "Frontend Development",
  "Backend Development",
  "Mobile App Development",
  "Cloud Solutions",
  "DevOps",
  "AI Integration",
  "MCP Servers",
  "Business Automation",
  "Deployment",
  "Maintenance & Support",
  "Performance Optimization",
  "UI/UX Development",
  "Technical Consulting",
] as const;

export const consultantInputSchema = z
  .object({
    projectType: z.enum([
      "website",
      "ecommerce",
      "web-app",
      "saas",
      "mobile-app",
      "enterprise",
      "ai-automation",
      "not-sure",
    ]),
    stage: z.enum(["idea", "validation", "existing-product", "scaling"]),
    goals: z.string().trim().min(30).max(1600),
    audience: z.string().trim().min(3).max(300),
    mustHaveFeatures: z.string().trim().min(3).max(800),
    budget: z.enum([
      "under-2-lakh",
      "2-5-lakh",
      "5-15-lakh",
      "15-40-lakh",
      "40-lakh-plus",
      "not-sure",
    ]),
    timeline: z.enum(["under-8-weeks", "2-4-months", "4-8-months", "flexible"]),
  })
  .strict();

export type ConsultantInput = z.infer<typeof consultantInputSchema>;

export const consultantRecommendationSchema = z
  .object({
    summary: z.string().min(30).max(700),
    recommendedPackage: z.enum([
      "Launch",
      "Growth",
      "Scale",
      "Discovery first",
    ]),
    recommendedServices: z.array(z.enum(consultantServiceNames)).min(1).max(5),
    scope: z.array(z.string().min(3).max(180)).min(3).max(8),
    technologyStack: z.array(z.string().min(2).max(60)).min(2).max(8),
    team: z.array(z.string().min(2).max(80)).min(2).max(8),
    addOns: z.array(z.string().min(2).max(120)).max(6),
    assumptions: z.array(z.string().min(3).max(180)).min(2).max(6),
    clarifyingQuestions: z.array(z.string().min(3).max(180)).max(5),
    nextStep: z.string().min(10).max(240),
  })
  .strict();

export type ConsultantRecommendation = z.infer<
  typeof consultantRecommendationSchema
>;

export type ConsultantResponse =
  | {
      ok: true;
      recommendation: ConsultantRecommendation;
      quote: ProjectEstimate;
      model: string;
    }
  | {
      ok: false;
      code: "INVALID" | "RATE_LIMITED" | "NOT_CONFIGURED" | "UNAVAILABLE";
      message: string;
    };

export const consultantJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    recommendedPackage: {
      type: "string",
      enum: ["Launch", "Growth", "Scale", "Discovery first"],
    },
    recommendedServices: {
      type: "array",
      items: { type: "string", enum: consultantServiceNames },
    },
    scope: { type: "array", items: { type: "string" } },
    technologyStack: { type: "array", items: { type: "string" } },
    team: { type: "array", items: { type: "string" } },
    addOns: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    clarifyingQuestions: { type: "array", items: { type: "string" } },
    nextStep: { type: "string" },
  },
  required: [
    "summary",
    "recommendedPackage",
    "recommendedServices",
    "scope",
    "technologyStack",
    "team",
    "addOns",
    "assumptions",
    "clarifyingQuestions",
    "nextStep",
  ],
} as const;

export function consultantSummary(
  recommendation: ConsultantRecommendation,
  quote: ProjectEstimate,
) {
  return `${recommendation.recommendedPackage} recommendation: ${recommendation.summary} Deterministic estimate ₹${quote.minimum.toLocaleString("en-IN")}–₹${quote.maximum.toLocaleString("en-IN")}, ${quote.timelineMinWeeks}–${quote.timelineMaxWeeks} weeks, ${quote.teamSize}. Services: ${recommendation.recommendedServices.join(", ")}.`;
}
