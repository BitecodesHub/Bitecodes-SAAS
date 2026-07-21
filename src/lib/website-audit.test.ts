import { describe, expect, it } from "vitest";
import {
  calculateAuditScores,
  websiteAuditInputSchema,
  type AuditFinding,
} from "@/lib/website-audit";

describe("website audit contracts", () => {
  it("accepts a bounded URL input and rejects unknown fields", () => {
    expect(
      websiteAuditInputSchema.safeParse({ url: "example.com" }).success,
    ).toBe(true);
    expect(
      websiteAuditInputSchema.safeParse({ url: "example.com", deepScan: true })
        .success,
    ).toBe(false);
  });

  it("calculates per-category and overall scores", () => {
    const findings: AuditFinding[] = [
      { category: "seo", status: "fail", title: "Title", detail: "Missing" },
      {
        category: "performance",
        status: "warning",
        title: "Response",
        detail: "Slow",
      },
      {
        category: "accessibility",
        status: "pass",
        title: "Language",
        detail: "Present",
      },
      {
        category: "security",
        status: "warning",
        title: "CSP",
        detail: "Missing",
      },
    ];

    const result = calculateAuditScores(findings);
    expect(result.scores.seo).toBe(78);
    expect(result.scores.performance).toBe(90);
    expect(result.scores.accessibility).toBe(100);
    expect(result.scores.security).toBe(90);
    expect(result.overallScore).toBe(90);
  });
});
