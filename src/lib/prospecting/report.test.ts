import { describe, expect, it } from "vitest";
import {
  buildObservations,
  buildReportItems,
  reportHeadline,
  reportItemForTag,
} from "@/lib/prospecting/report";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";
import type { ProspectSignals, ProspectTag } from "@/lib/server/db/types";

const ALL_TAGS = Object.keys(PROSPECT_TAG_LABELS) as ProspectTag[];

function signals(overrides: Partial<ProspectSignals> = {}): ProspectSignals {
  return {
    reachable: true,
    https: true,
    responsive: true,
    responseTimeMs: 400,
    htmlBytes: 50_000,
    hasStructuredData: true,
    hasFavicon: true,
    hasOpenGraph: true,
    hasAnalytics: true,
    hasBooking: true,
    hasEcommerce: true,
    hasChat: true,
    hasBlog: true,
    hasContactForm: true,
    hasSocialLinks: true,
    platform: "WordPress",
    copyrightYear: 2026,
    ...overrides,
  };
}

describe("reportItemForTag", () => {
  it("has copy for every tag the classifier can emit", () => {
    // A missing entry would render an empty section to a prospective customer.
    for (const tag of ALL_TAGS) {
      const item = reportItemForTag(tag);
      expect(item.title, tag).toBeTruthy();
      expect(item.why.length, tag).toBeGreaterThan(40);
      expect(item.fix.length, tag).toBeGreaterThan(20);
      expect(["high", "medium", "low"]).toContain(item.severity);
    }
  });

  it("makes no numeric claims it cannot support", () => {
    // Invented statistics ("you are losing 40% of visitors") are checkable and
    // destroy credibility. Percentages and money figures are banned outright.
    for (const tag of ALL_TAGS) {
      const item = reportItemForTag(tag);
      const text = `${item.title} ${item.why} ${item.fix}`;
      expect(text, tag).not.toMatch(/\d+\s?%/);
      expect(text, tag).not.toMatch(/[$£€₹]\s?\d/);
    }
  });

  it("frames a healthy site as an opportunity, not a problem", () => {
    const item = reportItemForTag("strong-website");
    expect(item.severity).toBe("low");
    expect(item.title.toLowerCase()).toContain("good shape");
  });
});

describe("buildReportItems", () => {
  it("keeps the classifier's order", () => {
    const items = buildReportItems(["not-mobile-friendly", "seo-gaps"]);
    expect(items[0]!.title).toContain("phones");
    expect(items[1]!.title).toContain("Search engines");
  });

  it("caps the list so it reads as a summary, not an attack", () => {
    const items = buildReportItems([
      "website-down",
      "not-mobile-friendly",
      "insecure-website",
      "slow-website",
      "seo-gaps",
      "accessibility-gaps",
      "feature-upgrade",
    ]);
    expect(items).toHaveLength(4);
  });

  it("de-duplicates repeated tags", () => {
    expect(buildReportItems(["seo-gaps", "seo-gaps"])).toHaveLength(1);
  });

  it("returns nothing for an empty tag list", () => {
    expect(buildReportItems([])).toEqual([]);
  });

  it("honours a custom limit", () => {
    expect(
      buildReportItems(["website-down", "seo-gaps", "slow-website"], 2),
    ).toHaveLength(2);
  });
});

describe("buildObservations", () => {
  it("lists what was checked, with pass or fail", () => {
    const list = buildObservations(signals({ https: false }));
    const https = list.find((entry) => entry.label.includes("HTTPS"));
    expect(https).toEqual({
      label: "Secure connection (HTTPS)",
      value: "No",
      ok: false,
    });
  });

  it("reports timing and page size in human units", () => {
    const list = buildObservations(
      signals({ responseTimeMs: 2_400, htmlBytes: 512_000 }),
    );
    expect(list.find((e) => e.label.includes("first response"))?.value).toBe(
      "2.40s",
    );
    expect(list.find((e) => e.label === "Page size")?.value).toBe("500 KB");
  });

  it("marks a slow response and a heavy page as not ok", () => {
    const list = buildObservations(
      signals({ responseTimeMs: 4_000, htmlBytes: 900_000 }),
    );
    expect(list.find((e) => e.label.includes("first response"))?.ok).toBe(
      false,
    );
    expect(list.find((e) => e.label === "Page size")?.ok).toBe(false);
  });

  it("treats the platform and copyright year as neutral facts", () => {
    const list = buildObservations(signals());
    expect(list.find((e) => e.label === "Built with")?.ok).toBeNull();
    expect(list.find((e) => e.label.includes("copyright"))?.ok).toBeNull();
  });

  it("omits optional rows when the data is absent", () => {
    const list = buildObservations(
      signals({
        platform: null,
        copyrightYear: null,
        responseTimeMs: null,
        htmlBytes: null,
      }),
    );
    expect(list.some((e) => e.label === "Built with")).toBe(false);
    expect(list.some((e) => e.label === "Page size")).toBe(false);
  });

  it("returns nothing when the site could not be reached", () => {
    // With no observations there is nothing to display, which is correct: we
    // must not present a table of "No" answers as if we had measured them.
    expect(buildObservations(null)).toEqual([]);
    expect(buildObservations(signals({ reachable: false }))).toEqual([]);
  });

  it("never rounds a small page down to zero KB", () => {
    expect(
      buildObservations(signals({ htmlBytes: 100 })).find(
        (e) => e.label === "Page size",
      )?.value,
    ).toBe("1 KB");
  });
});

describe("reportHeadline", () => {
  it("names the business and leads with the main finding", () => {
    expect(reportHeadline("Café Rossi", "no-website")).toBe(
      "We could not find a website for Café Rossi.",
    );
    expect(reportHeadline("Café Rossi", "website-down")).toContain(
      "did not load",
    );
    expect(reportHeadline("Café Rossi", "strong-website")).toContain(
      "holds up well",
    );
    expect(reportHeadline("Café Rossi", "seo-gaps")).toContain(
      "a few things worth fixing",
    );
  });

  it("produces a sentence for every tag", () => {
    for (const tag of ALL_TAGS) {
      const headline = reportHeadline("Rossi", tag);
      expect(headline, tag).toContain("Rossi");
      expect(headline.endsWith("."), tag).toBe(true);
    }
  });
});
