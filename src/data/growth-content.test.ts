import { describe, expect, it } from "vitest";
import { answerCategories, answerPages, relatedAnswers } from "@/data/answers";
import { comparisonPages, relatedComparisons } from "@/data/comparisons";
import { launchTemplates, relatedTemplates } from "@/data/templates";

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("answer library", () => {
  const slugs = new Set(answerPages.map((page) => page.slug));

  it("has unique, URL-safe slugs and a useful number of answers", () => {
    expect(answerPages.length).toBeGreaterThanOrEqual(12);
    for (const page of answerPages) {
      expect(page.slug, page.question).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(page.question.trim().endsWith("?"), page.slug).toBe(true);
    }
    expect(slugs.size).toBe(answerPages.length);
  });

  it("opens every answer with a quotable, self-contained response", () => {
    for (const page of answerPages) {
      expect(wordCount(page.shortAnswer), page.slug).toBeGreaterThanOrEqual(30);
      expect(page.metaDescription.length, page.slug).toBeGreaterThanOrEqual(50);
      expect(page.metaDescription.length, page.slug).toBeLessThanOrEqual(160);
      expect(page.updated, page.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(page.readingMinutes, page.slug).toBeGreaterThan(0);
      expect(answerCategories, page.slug).toContain(page.category);
    }
  });

  it("supports each answer with sections and FAQs", () => {
    for (const page of answerPages) {
      expect(page.sections.length, page.slug).toBeGreaterThanOrEqual(2);
      for (const section of page.sections) {
        expect(section.heading.trim(), page.slug).not.toBe("");
        expect(section.paragraphs.length, page.slug).toBeGreaterThanOrEqual(1);
        for (const paragraph of section.paragraphs) {
          expect(wordCount(paragraph), page.slug).toBeGreaterThanOrEqual(15);
        }
      }
      expect(page.faqs.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(page.faqs.length, page.slug).toBeLessThanOrEqual(5);
      for (const faq of page.faqs) {
        expect(
          wordCount(faq.answer),
          `${page.slug}: ${faq.question}`,
        ).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("links only to real answers and never to itself", () => {
    for (const page of answerPages) {
      expect(page.related.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(page.related, page.slug).not.toContain(page.slug);
      for (const slug of page.related) {
        expect(slugs.has(slug), `${page.slug}: ${slug}`).toBe(true);
      }
      expect(relatedAnswers(page)).toHaveLength(page.related.length);
      expect(page.cta.href.startsWith("/"), page.slug).toBe(true);
    }
  });
});

describe("comparison pages", () => {
  const slugs = new Set(comparisonPages.map((page) => page.slug));
  const answerSlugs = new Set(answerPages.map((page) => page.slug));

  it("has unique slugs and covers the common alternatives", () => {
    expect(comparisonPages.length).toBeGreaterThanOrEqual(4);
    for (const page of comparisonPages) {
      expect(page.slug, page.title).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(page.title.trim(), page.slug).not.toBe("");
      expect(page.alternativeName.trim(), page.slug).not.toBe("");
      expect(page.metaDescription.length, page.slug).toBeGreaterThanOrEqual(50);
      expect(page.metaDescription.length, page.slug).toBeLessThanOrEqual(160);
      expect(page.updated, page.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(slugs.size).toBe(comparisonPages.length);
  });

  it("compares on real dimensions and admits where the alternative wins", () => {
    for (const page of comparisonPages) {
      expect(wordCount(page.shortAnswer), page.slug).toBeGreaterThanOrEqual(30);
      expect(page.rows.length, page.slug).toBeGreaterThanOrEqual(4);
      for (const row of page.rows) {
        expect(row.label.trim(), page.slug).not.toBe("");
        expect(row.bitecodes.trim(), page.slug).not.toBe("");
        expect(row.alternative.trim(), page.slug).not.toBe("");
      }
      expect(page.chooseBitecodes.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(page.chooseAlternative.length, page.slug).toBeGreaterThanOrEqual(
        2,
      );
      expect(wordCount(page.verdict), page.slug).toBeGreaterThanOrEqual(20);
      expect(page.faqs.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(page.cta.href.startsWith("/"), page.slug).toBe(true);
    }
  });

  it("links only to real comparisons or answers and never to itself", () => {
    for (const page of comparisonPages) {
      expect(page.related.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(page.related, page.slug).not.toContain(page.slug);
      for (const slug of page.related) {
        expect(
          slugs.has(slug) || answerSlugs.has(slug),
          `${page.slug}: ${slug}`,
        ).toBe(true);
      }
      expect(relatedComparisons(page).length, page.slug).toBeGreaterThanOrEqual(
        1,
      );
    }
  });
});

describe("launch templates", () => {
  it("has unique slugs and complete palettes", () => {
    expect(launchTemplates.length).toBeGreaterThanOrEqual(3);
    const slugs = launchTemplates.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const template of launchTemplates) {
      expect(template.slug, template.name).toMatch(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      );
      expect(template.industry.trim(), template.slug).not.toBe("");
      expect(template.tagline.trim(), template.slug).not.toBe("");
      expect(
        template.metaDescription.length,
        template.slug,
      ).toBeGreaterThanOrEqual(50);
      expect(
        template.metaDescription.length,
        template.slug,
      ).toBeLessThanOrEqual(160);
      for (const [token, value] of Object.entries(template.palette)) {
        expect(value, `${template.slug}: ${token}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("describes a complete page direction, not a stub", () => {
    for (const template of launchTemplates) {
      expect(template.nav.length, template.slug).toBeGreaterThanOrEqual(3);
      expect(template.hero.headline.trim(), template.slug).not.toBe("");
      expect(template.hero.subhead.trim(), template.slug).not.toBe("");
      expect(template.hero.stats.length, template.slug).toBeGreaterThanOrEqual(
        2,
      );
      expect(template.features.length, template.slug).toBeGreaterThanOrEqual(3);
      for (const feature of template.features) {
        expect(feature.title.trim(), template.slug).not.toBe("");
        expect(feature.description.trim(), template.slug).not.toBe("");
      }
      expect(template.testimonial.quote.trim(), template.slug).not.toBe("");
      expect(template.finalCta.heading.trim(), template.slug).not.toBe("");
      expect(template.bestFor.length, template.slug).toBeGreaterThanOrEqual(3);
      expect(template.included.length, template.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("suggests other templates without repeating the current one", () => {
    for (const template of launchTemplates) {
      const related = relatedTemplates(template.slug);
      expect(related, template.slug).toHaveLength(launchTemplates.length - 1);
      expect(related.map((item) => item.slug)).not.toContain(template.slug);
    }
  });
});
