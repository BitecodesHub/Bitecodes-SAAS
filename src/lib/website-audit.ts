import { z } from "zod";

export const websiteAuditInputSchema = z
  .object({
    url: z.string().trim().min(3).max(500),
  })
  .strict();

export type AuditCategory =
  | "seo"
  | "performance"
  | "accessibility"
  | "security";
export type AuditStatus = "pass" | "warning" | "fail";

export interface AuditFinding {
  category: AuditCategory;
  status: AuditStatus;
  title: string;
  detail: string;
  recommendation?: string;
}

export interface WebsiteAuditResult {
  auditedUrl: string;
  finalUrl: string;
  auditedAt: string;
  responseTimeMs: number;
  statusCode: number;
  scores: Record<AuditCategory, number>;
  overallScore: number;
  findings: AuditFinding[];
  scope: string;
}

export type WebsiteAuditResponse =
  | { ok: true; result: WebsiteAuditResult }
  | {
      ok: false;
      code: "INVALID" | "BLOCKED" | "RATE_LIMITED" | "UNAVAILABLE";
      message: string;
    };

const categoryLabels: Record<AuditCategory, string> = {
  seo: "SEO",
  performance: "Performance",
  accessibility: "Accessibility",
  security: "Security",
};

export function categoryLabel(category: AuditCategory) {
  return categoryLabels[category];
}

export function calculateAuditScores(findings: AuditFinding[]) {
  const categories: AuditCategory[] = [
    "seo",
    "performance",
    "accessibility",
    "security",
  ];
  const scores = Object.fromEntries(
    categories.map((category) => {
      const categoryFindings = findings.filter(
        (finding) => finding.category === category,
      );
      const deductions = categoryFindings.reduce(
        (total, finding) =>
          total +
          (finding.status === "fail"
            ? 22
            : finding.status === "warning"
              ? 10
              : 0),
        0,
      );
      return [category, Math.max(0, 100 - deductions)];
    }),
  ) as Record<AuditCategory, number>;

  const overallScore = Math.round(
    categories.reduce((total, category) => total + scores[category], 0) /
      categories.length,
  );

  return { scores, overallScore };
}
