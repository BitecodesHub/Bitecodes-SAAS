import { z } from "zod";

export const projectTypes = [
  {
    value: "business-website",
    label: "Business website",
    base: 18_000,
    weeks: 5,
  },
  { value: "ecommerce", label: "eCommerce store", base: 45_000, weeks: 8 },
  {
    value: "web-app",
    label: "Custom web application",
    base: 90_000,
    weeks: 12,
  },
  { value: "saas-mvp", label: "SaaS or startup MVP", base: 140_000, weeks: 16 },
  {
    value: "mobile-app",
    label: "Mobile application",
    base: 130_000,
    weeks: 16,
  },
  {
    value: "enterprise",
    label: "Enterprise software",
    base: 300_000,
    weeks: 24,
  },
  {
    value: "ai-automation",
    label: "AI integration or automation",
    base: 80_000,
    weeks: 10,
  },
] as const;

export const complexityLevels = [
  { value: "essential", label: "Essential", multiplier: 1, timeline: 1 },
  { value: "growth", label: "Growth", multiplier: 1.45, timeline: 1.25 },
  { value: "advanced", label: "Advanced", multiplier: 2.1, timeline: 1.65 },
] as const;

export const estimatorFeatures = [
  {
    value: "custom-design",
    label: "Custom product design",
    cost: 20_000,
    weeks: 2,
  },
  {
    value: "authentication",
    label: "Accounts and roles",
    cost: 18_000,
    weeks: 2,
  },
  {
    value: "payments",
    label: "Payments or subscriptions",
    cost: 24_000,
    weeks: 2,
  },
  { value: "admin", label: "Admin dashboard", cost: 32_000, weeks: 3 },
  {
    value: "integrations",
    label: "Third-party integrations",
    cost: 25_000,
    weeks: 2,
  },
  { value: "realtime", label: "Real-time features", cost: 30_000, weeks: 3 },
  { value: "ai", label: "AI-powered workflow", cost: 35_000, weeks: 3 },
  { value: "migration", label: "Data migration", cost: 20_000, weeks: 2 },
] as const;

const projectValues = projectTypes.map((item) => item.value) as [
  (typeof projectTypes)[number]["value"],
  ...(typeof projectTypes)[number]["value"][],
];
const complexityValues = complexityLevels.map((item) => item.value) as [
  (typeof complexityLevels)[number]["value"],
  ...(typeof complexityLevels)[number]["value"][],
];
const featureValues = estimatorFeatures.map((item) => item.value) as [
  (typeof estimatorFeatures)[number]["value"],
  ...(typeof estimatorFeatures)[number]["value"][],
];

export const estimateInputSchema = z.object({
  projectType: z.enum(projectValues),
  complexity: z.enum(complexityValues),
  platforms: z.coerce.number().int().min(1).max(3),
  features: z.array(z.enum(featureValues)).max(estimatorFeatures.length),
  urgency: z.enum(["standard", "priority"]),
  support: z.enum(["launch", "quarter", "annual"]),
});

export type EstimateInput = z.infer<typeof estimateInputSchema>;

export interface ProjectEstimate {
  minimum: number;
  maximum: number;
  timelineMinWeeks: number;
  timelineMaxWeeks: number;
  teamSize: string;
  projectLabel: string;
  assumptions: string[];
}

const supportCosts = { launch: 0, quarter: 90_000, annual: 300_000 } as const;

function roundToTenThousand(value: number) {
  return Math.round(value / 10_000) * 10_000;
}

export function calculateProjectEstimate(
  rawInput: EstimateInput,
): ProjectEstimate {
  const input = estimateInputSchema.parse(rawInput);
  const project = projectTypes.find(
    (item) => item.value === input.projectType,
  )!;
  const complexity = complexityLevels.find(
    (item) => item.value === input.complexity,
  )!;
  const selectedFeatures = estimatorFeatures.filter((item) =>
    input.features.includes(item.value),
  );

  const featureCost = selectedFeatures.reduce(
    (sum, item) => sum + item.cost,
    0,
  );
  const featureWeeks = selectedFeatures.reduce(
    (sum, item) => sum + item.weeks,
    0,
  );
  const platformMultiplier = 1 + (input.platforms - 1) * 0.32;
  const urgencyMultiplier = input.urgency === "priority" ? 1.2 : 1;
  const subtotal =
    (project.base * complexity.multiplier + featureCost) *
      platformMultiplier *
      urgencyMultiplier +
    supportCosts[input.support];
  const minimum = roundToTenThousand(subtotal * 0.9);
  const maximum = roundToTenThousand(subtotal * 1.18);
  const baseWeeks = (project.weeks + featureWeeks * 0.55) * complexity.timeline;
  const urgencyTimeline = input.urgency === "priority" ? 0.82 : 1;
  const timelineMinWeeks = Math.max(
    3,
    Math.round(baseWeeks * urgencyTimeline * 0.9),
  );
  const timelineMaxWeeks = Math.max(
    timelineMinWeeks + 2,
    Math.round(baseWeeks * urgencyTimeline * 1.18),
  );

  return {
    minimum,
    maximum,
    timelineMinWeeks,
    timelineMaxWeeks,
    teamSize:
      maximum < 400_000
        ? "2–3 specialists"
        : maximum < 1_200_000
          ? "3–5 specialists"
          : "5–8 specialists",
    projectLabel: project.label,
    assumptions: [
      "Includes discovery, design, engineering, QA, deployment, and project management.",
      "Third-party subscriptions, cloud usage, app-store fees, and GST are excluded.",
      "The final fixed quote follows a short technical discovery and scope review.",
    ],
  };
}

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function estimateSummary(
  input: EstimateInput,
  estimate: ProjectEstimate,
) {
  return `${estimate.projectLabel}: ${formatInr(estimate.minimum)}–${formatInr(estimate.maximum)}, ${estimate.timelineMinWeeks}–${estimate.timelineMaxWeeks} weeks, ${estimate.teamSize}. Configuration: ${input.complexity} complexity, ${input.platforms} platform(s), ${input.features.length} selected add-on(s), ${input.support} support.`;
}
