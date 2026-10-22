import { describe, expect, it } from "vitest";
import {
  AUDIT_PATHS,
  compareAudits,
  type AuditPageResult,
} from "@/lib/server/jobs/handlers/seo-selfaudit";

const current: AuditPageResult[] = [
  { path: "/", score: 92, issues: [] },
  { path: "/pricing", score: 68, issues: ["seo: Meta description"] },
  { path: "/contact", score: null, issues: ["audit failed: timeout"] },
];

describe("compareAudits", () => {
  it("reports nothing on a first run", () => {
    expect(compareAudits(null, current)).toEqual([]);
  });

  it("reports a score drop, a new issue, and a failed page", () => {
    const regressions = compareAudits(
      {
        pages: [
          { path: "/", score: 100, issues: [] },
          { path: "/pricing", score: 68, issues: [] },
          { path: "/contact", score: 90, issues: [] },
        ],
      },
      current,
    );

    expect(regressions).toContain("/: score fell from 100 to 92.");
    expect(regressions).toContain(
      "/pricing: new issue — seo: Meta description.",
    );
    expect(regressions).toContain("/contact: could not be audited this run.");
  });

  it("does not treat an improved score as a regression", () => {
    const regressions = compareAudits(
      {
        pages: [{ path: "/", score: 80, issues: [] }],
      },
      [{ path: "/", score: 90, issues: [] }],
    );

    expect(regressions).toEqual([]);
  });

  it("does not report an issue that was already present", () => {
    const regressions = compareAudits(
      {
        pages: [
          {
            path: "/pricing",
            score: 68,
            issues: ["seo: Meta description"],
          },
        ],
      },
      [{ path: "/pricing", score: 68, issues: ["seo: Meta description"] }],
    );

    expect(regressions).toEqual([]);
  });
});

describe("AUDIT_PATHS", () => {
  it("covers eight distinct pages", () => {
    expect(AUDIT_PATHS).toHaveLength(8);
    expect(new Set(AUDIT_PATHS).size).toBe(AUDIT_PATHS.length);
  });
});
