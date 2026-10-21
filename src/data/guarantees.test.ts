import { describe, expect, it } from "vitest";
import { guarantees, guaranteeFaqs } from "@/data/guarantees";
import { services } from "@/data/services";

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("guarantees", () => {
  const serviceSlugs = new Set(services.map((service) => service.slug));

  it("has unique slugs", () => {
    const slugs = guarantees.map((guarantee) => guarantee.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers every commitment listed in the growth plan", () => {
    const slugs = new Set(guarantees.map((guarantee) => guarantee.slug));
    expect([...slugs].sort()).toEqual(
      [
        "client-owns-code",
        "code-in-your-repository",
        "defect-fix-window",
        "milestone-payments",
        "nda-on-request",
        "no-lock-in",
        "support-response-targets",
        "written-change-requests",
        "written-fixed-quote",
      ].sort(),
    );
  });

  it("references only real service slugs or all", () => {
    for (const guarantee of guarantees) {
      expect(guarantee.appliesTo.length, guarantee.slug).toBeGreaterThan(0);
      for (const slug of guarantee.appliesTo) {
        if (slug === "all") continue;
        expect(serviceSlugs.has(slug), `${guarantee.slug}: ${slug}`).toBe(true);
      }
    }
  });

  it("states the commitment and its limits", () => {
    for (const guarantee of guarantees) {
      expect(guarantee.title.trim(), guarantee.slug).toBeTruthy();
      expect(guarantee.commitment.trim(), guarantee.slug).toBeTruthy();
      expect(guarantee.details.length, guarantee.slug).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("keeps every guarantee FAQ answer between 25 and 60 words", () => {
    for (const faq of guaranteeFaqs) {
      const count = wordCount(faq.answer);
      expect(count, faq.question).toBeGreaterThanOrEqual(25);
      expect(count, faq.question).toBeLessThanOrEqual(60);
    }
  });
});
