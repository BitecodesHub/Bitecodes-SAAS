import "server-only";

import type { ConsultantInput } from "@/lib/ai-consultant";
import {
  calculateProjectEstimate,
  type EstimateInput,
} from "@/lib/cost-estimator";

const projectMapping: Record<
  ConsultantInput["projectType"],
  EstimateInput["projectType"]
> = {
  website: "business-website",
  ecommerce: "ecommerce",
  "web-app": "web-app",
  saas: "saas-mvp",
  "mobile-app": "mobile-app",
  enterprise: "enterprise",
  "ai-automation": "ai-automation",
  "not-sure": "web-app",
};

const stageComplexity: Record<
  ConsultantInput["stage"],
  EstimateInput["complexity"]
> = {
  idea: "essential",
  validation: "growth",
  "existing-product": "growth",
  scaling: "advanced",
};

const projectFeatures: Record<
  ConsultantInput["projectType"],
  EstimateInput["features"]
> = {
  website: ["custom-design", "admin"],
  ecommerce: ["custom-design", "payments", "admin", "integrations"],
  "web-app": ["custom-design", "authentication", "admin"],
  saas: ["custom-design", "authentication", "payments", "admin"],
  "mobile-app": ["custom-design", "authentication", "admin", "integrations"],
  enterprise: ["authentication", "admin", "integrations", "migration"],
  "ai-automation": ["ai", "integrations", "admin"],
  "not-sure": ["custom-design", "authentication", "admin"],
};

export function createDeterministicConsultantQuote(input: ConsultantInput) {
  const estimateInput: EstimateInput = {
    projectType: projectMapping[input.projectType],
    complexity: stageComplexity[input.stage],
    platforms: input.projectType === "mobile-app" ? 2 : 1,
    features: projectFeatures[input.projectType],
    urgency: input.timeline === "under-8-weeks" ? "priority" : "standard",
    support: "quarter",
  };

  return calculateProjectEstimate(estimateInput);
}
