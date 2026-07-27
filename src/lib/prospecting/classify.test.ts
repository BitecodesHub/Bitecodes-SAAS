import { describe, expect, it } from "vitest";
import {
  PROSPECT_TAG_LABELS,
  classifyProspect,
  compareByOpportunity,
  type ClassifyInput,
} from "@/lib/prospecting/classify";
import { unreachableSignals } from "@/lib/prospecting/signals";
import type { ProspectSignals, ProspectTag } from "@/lib/server/db/types";

/** A healthy, fully featured site. Tests switch off one thing at a time. */
function goodSignals(
  overrides: Partial<ProspectSignals> = {},
): ProspectSignals {
  return {
    reachable: true,
    https: true,
    responsive: true,
    responseTimeMs: 300,
    htmlBytes: 40_000,
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
    platform: "Next.js",
    copyrightYear: new Date().getUTCFullYear(),
    ...overrides,
  };
}

function classify(overrides: Partial<ClassifyInput> = {}) {
  return classifyProspect({
    hasWebsite: true,
    signals: goodSignals(),
    hasEmail: true,
    hasPhone: true,
    currentYear: 2026,
    ...overrides,
  });
}

describe("labels", () => {
  it("names every tag the classifier can emit", () => {
    const tags: ProspectTag[] = [
      "no-website",
      "website-down",
      "not-mobile-friendly",
      "slow-website",
      "insecure-website",
      "seo-gaps",
      "accessibility-gaps",
      "feature-upgrade",
      "strong-website",
    ];
    for (const tag of tags) {
      expect(PROSPECT_TAG_LABELS[tag]).toBeTruthy();
    }
  });
});

describe("no website", () => {
  it("is the primary reason and outranks everything else", () => {
    const result = classify({ hasWebsite: false, signals: null });
    expect(result.primaryTag).toBe("no-website");
    expect(result.topIssues[0]).toBe("No website found");
    expect(result.score).toBeGreaterThan(80);
  });

  it("distinguishes a social-only presence and scores it slightly lower", () => {
    const social = classify({
      hasWebsite: false,
      socialOnly: true,
      signals: null,
    });
    const none = classify({ hasWebsite: false, signals: null });

    expect(social.primaryTag).toBe("no-website");
    expect(social.topIssues[0]).toBe("Only a social page, no website");
    // Same reason, lower willingness to spend.
    expect(social.score).toBeLessThan(none.score);
  });

  it("does not invent website problems when there is no website", () => {
    const result = classify({ hasWebsite: false, signals: null });
    expect(result.tags).toEqual(["no-website"]);
  });

  it("still classifies when signals are absent", () => {
    expect(() =>
      classifyProspect({ hasWebsite: false, signals: null }),
    ).not.toThrow();
  });
});

describe("website down", () => {
  it("beats every other reason, because it is an emergency", () => {
    const result = classify({ signals: unreachableSignals() });
    expect(result.primaryTag).toBe("website-down");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("treats null signals on a site that exists as down", () => {
    expect(classify({ signals: null }).primaryTag).toBe("website-down");
  });

  it("reports only the outage, not speculation about the page", () => {
    expect(classify({ signals: unreachableSignals() }).tags).toEqual([
      "website-down",
    ]);
  });
});

describe("mobile, security, speed ordering", () => {
  it("puts mobile ahead of security and speed", () => {
    const result = classify({
      signals: goodSignals({
        responsive: false,
        https: false,
        responseTimeMs: 9_000,
      }),
    });
    expect(result.primaryTag).toBe("not-mobile-friendly");
    expect(result.tags).toContain("insecure-website");
    expect(result.tags).toContain("slow-website");
    // Supporting detail follows the primary reason in severity order.
    expect(result.tags.indexOf("insecure-website")).toBeLessThan(
      result.tags.indexOf("slow-website"),
    );
  });

  it("flags plain http as insecure", () => {
    const result = classify({ signals: goodSignals({ https: false }) });
    expect(result.primaryTag).toBe("insecure-website");
    expect(result.topIssues[0]).toContain("Not secure");
  });

  it("flags missing security headers separately from missing HTTPS", () => {
    const result = classify({
      signals: goodSignals(),
      auditScores: {
        seo: 90,
        performance: 90,
        accessibility: 90,
        security: 40,
      },
    });
    expect(result.tags).toContain("insecure-website");
    expect(result.topIssues.join(" ")).toContain("security headers");
  });

  it("quantifies slowness from the response time", () => {
    const result = classify({
      signals: goodSignals({ responseTimeMs: 3_400 }),
    });
    expect(result.primaryTag).toBe("slow-website");
    expect(result.topIssues[0]).toContain("3.4s");
  });

  it("quantifies slowness from page weight", () => {
    const result = classify({
      signals: goodSignals({ responseTimeMs: 200, htmlBytes: 900_000 }),
    });
    expect(result.primaryTag).toBe("slow-website");
    expect(result.topIssues[0]).toContain("KB of HTML");
  });

  it("accepts a fast, light page", () => {
    const result = classify({
      signals: goodSignals({ responseTimeMs: 2_499, htmlBytes: 399_999 }),
    });
    expect(result.tags).not.toContain("slow-website");
  });

  it("uses the audit performance score when timings look fine", () => {
    const result = classify({
      auditScores: {
        seo: 90,
        performance: 40,
        accessibility: 90,
        security: 90,
      },
    });
    expect(result.tags).toContain("slow-website");
  });
});

describe("seo gaps", () => {
  it("needs two gaps before it is worth mentioning", () => {
    const one = classify({
      signals: goodSignals({ hasStructuredData: false }),
    });
    expect(one.tags).not.toContain("seo-gaps");

    const two = classify({
      signals: goodSignals({ hasStructuredData: false, hasOpenGraph: false }),
    });
    expect(two.tags).toContain("seo-gaps");
    expect(two.topIssues.join(" ")).toContain("structured data");
  });

  it("counts weak audit metadata as a gap", () => {
    const result = classify({
      signals: goodSignals({ hasStructuredData: false }),
      auditScores: {
        seo: 40,
        performance: 90,
        accessibility: 90,
        security: 90,
      },
    });
    expect(result.tags).toContain("seo-gaps");
  });
});

describe("accessibility", () => {
  it("is raised from the audit score and ranks last", () => {
    const result = classify({
      signals: goodSignals(),
      auditScores: {
        seo: 90,
        performance: 90,
        accessibility: 30,
        security: 90,
      },
    });
    expect(result.primaryTag).toBe("accessibility-gaps");
    expect(result.score).toBeLessThan(60);
  });
});

describe("feature gaps by vertical", () => {
  it("tells a restaurant it cannot take reservations or orders", () => {
    const result = classify({
      categoryId: "food-drink",
      signals: goodSignals({ hasBooking: false, hasEcommerce: false }),
    });
    expect(result.primaryTag).toBe("feature-upgrade");
    expect(result.topIssues[0]).toContain("reserve a table");
    expect(result.topIssues[0]).toContain("online ordering");
  });

  it("tells a clinic it cannot take appointments", () => {
    const result = classify({
      categoryId: "health",
      signals: goodSignals({ hasBooking: false }),
    });
    expect(result.topIssues[0]).toContain("appointment booking");
  });

  it("makes the commission argument to a hotel", () => {
    const result = classify({
      categoryId: "hospitality",
      signals: goodSignals({ hasBooking: false }),
    });
    expect(result.topIssues[0]).toContain("commission");
  });

  it("tells a shop it has no online store", () => {
    const result = classify({
      categoryId: "retail",
      signals: goodSignals({ hasEcommerce: false }),
    });
    expect(result.topIssues[0]).toContain("online store");
  });

  it("does not ask a restaurant for a quote form", () => {
    // Vertical expectations must not leak between categories.
    const result = classify({
      categoryId: "food-drink",
      signals: goodSignals({ hasBooking: false, hasEcommerce: false }),
    });
    expect(result.topIssues.join(" ")).not.toContain("quote-request");
  });

  it("falls back to universal gaps with no known vertical", () => {
    const result = classify({
      categoryId: null,
      signals: goodSignals({ hasContactForm: false, hasAnalytics: false }),
    });
    expect(result.primaryTag).toBe("feature-upgrade");
    expect(result.topIssues[0]).toContain("contact form");
  });

  it("does not duplicate the form complaint when the vertical already made it", () => {
    const result = classify({
      categoryId: "trades",
      signals: goodSignals({ hasContactForm: false }),
    });
    const formMentions = result.topIssues[0]!.split("form").length - 1;
    expect(formMentions).toBe(1);
  });

  it("caps the gap list so the pitch stays short", () => {
    const result = classify({
      categoryId: "professional-services",
      signals: goodSignals({
        hasContactForm: false,
        hasBlog: false,
        hasAnalytics: false,
        hasChat: false,
      }),
    });
    expect(result.topIssues[0]!.split(";").length).toBeLessThanOrEqual(3);
  });
});

describe("strong website", () => {
  it("is the verdict when nothing is wrong, and is deprioritised", () => {
    const result = classify();
    expect(result.primaryTag).toBe("strong-website");
    expect(result.tags).toEqual(["strong-website"]);
    expect(result.score).toBeLessThan(35);
    expect(result.pitchAngles[0]).toContain("good shape");
  });

  it("still returns a usable pitch rather than an empty one", () => {
    const result = classify();
    expect(result.topIssues.length).toBeGreaterThan(0);
    expect(result.pitchAngles.length).toBeGreaterThan(0);
  });
});

describe("scoring", () => {
  it("rewards a reachable prospect and punishes an unreachable one", () => {
    const withEmail = classify({ hasWebsite: false, signals: null });
    const noContact = classify({
      hasWebsite: false,
      signals: null,
      hasEmail: false,
      hasPhone: false,
    });
    expect(withEmail.score).toBeGreaterThan(noContact.score);
  });

  it("rewards a high-value vertical", () => {
    const lawyer = classify({
      categoryId: "professional-services",
      signals: goodSignals({ responsive: false }),
    });
    const shop = classify({
      categoryId: "retail",
      signals: goodSignals({ responsive: false }),
    });
    expect(lawyer.score).toBeGreaterThan(shop.score);
  });

  it("rewards a stale copyright year", () => {
    const stale = classify({
      signals: goodSignals({ responsive: false, copyrightYear: 2018 }),
      currentYear: 2026,
    });
    const fresh = classify({
      signals: goodSignals({ responsive: false, copyrightYear: 2026 }),
      currentYear: 2026,
    });
    expect(stale.score).toBeGreaterThan(fresh.score);
  });

  it("rewards a locked-in website builder", () => {
    const wix = classify({
      signals: goodSignals({ responsive: false, platform: "Wix" }),
    });
    const custom = classify({
      signals: goodSignals({ responsive: false, platform: "Next.js" }),
    });
    expect(wix.score).toBeGreaterThan(custom.score);
  });

  it("stays within 0 and 100 at both extremes", () => {
    const worst = classifyProspect({
      hasWebsite: true,
      signals: goodSignals({
        responsive: false,
        https: false,
        responseTimeMs: 30_000,
        htmlBytes: 5_000_000,
        hasStructuredData: false,
        hasOpenGraph: false,
        hasContactForm: false,
        hasAnalytics: false,
        hasBooking: false,
        hasEcommerce: false,
        platform: "Wix",
        copyrightYear: 2010,
      }),
      auditScores: { seo: 0, performance: 0, accessibility: 0, security: 0 },
      categoryId: "professional-services",
      hasEmail: true,
      hasPhone: true,
      currentYear: 2026,
    });
    expect(worst.score).toBeLessThanOrEqual(100);
    expect(worst.score).toBeGreaterThanOrEqual(0);

    const best = classifyProspect({
      hasWebsite: true,
      signals: goodSignals(),
      hasEmail: false,
      hasPhone: false,
    });
    expect(best.score).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic", () => {
    const input: ClassifyInput = {
      hasWebsite: true,
      signals: goodSignals({ responsive: false }),
      categoryId: "health",
      hasEmail: true,
      currentYear: 2026,
    };
    expect(classifyProspect(input)).toEqual(classifyProspect(input));
  });
});

describe("output shape", () => {
  it("lists the primary tag first and never repeats a tag", () => {
    const result = classify({
      signals: goodSignals({
        responsive: false,
        https: false,
        hasStructuredData: false,
        hasOpenGraph: false,
        hasBooking: false,
      }),
      categoryId: "health",
    });
    expect(result.tags[0]).toBe(result.primaryTag);
    expect(new Set(result.tags).size).toBe(result.tags.length);
  });

  it("leads the pitch with the primary reason", () => {
    const result = classify({
      signals: goodSignals({ responsive: false, https: false }),
    });
    expect(result.pitchAngles[0]).toContain("mobile layout");
  });

  it("caps issues and pitch angles at five", () => {
    const result = classify({
      signals: goodSignals({
        responsive: false,
        https: false,
        responseTimeMs: 9_000,
        hasStructuredData: false,
        hasOpenGraph: false,
        hasBooking: false,
        hasContactForm: false,
        hasAnalytics: false,
      }),
      auditScores: {
        seo: 10,
        performance: 10,
        accessibility: 10,
        security: 10,
      },
      categoryId: "health",
    });
    expect(result.topIssues.length).toBeLessThanOrEqual(5);
    expect(result.pitchAngles.length).toBeLessThanOrEqual(5);
  });
});

describe("compareByOpportunity", () => {
  it("sorts by descending score", () => {
    const high = classify({ hasWebsite: false, signals: null });
    const low = classify();
    expect([low, high].sort(compareByOpportunity)[0]).toBe(high);
  });

  it("breaks a score tie with severity", () => {
    const a = {
      primaryTag: "website-down" as ProspectTag,
      tags: [],
      score: 50,
      pitchAngles: [],
      topIssues: [],
    };
    const b = {
      primaryTag: "seo-gaps" as ProspectTag,
      tags: [],
      score: 50,
      pitchAngles: [],
      topIssues: [],
    };
    expect([b, a].sort(compareByOpportunity)[0]).toBe(a);
  });
});
