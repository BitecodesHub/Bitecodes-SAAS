import { describe, expect, it } from "vitest";
import { industries } from "@/data/industries";
import { projects } from "@/data/projects";
import { services } from "@/data/services";

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("industries", () => {
  const serviceSlugs = new Set(services.map((service) => service.slug));
  const projectSlugs = new Set(projects.map((project) => project.slug));

  it("has unique slugs", () => {
    const slugs = industries.map((industry) => industry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every industry problems, an approach, services, and FAQs", () => {
    for (const industry of industries) {
      expect(industry.problems?.length, industry.slug).toBeGreaterThanOrEqual(
        3,
      );
      expect(industry.approach?.length, industry.slug).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        industry.relatedServices?.length,
        industry.slug,
      ).toBeGreaterThanOrEqual(2);
      expect(industry.faqs?.length, industry.slug).toBeGreaterThanOrEqual(3);
      expect(industry.faqs?.length, industry.slug).toBeLessThanOrEqual(5);
    }
  });

  it("references only real service slugs", () => {
    for (const industry of industries) {
      for (const slug of industry.relatedServices ?? []) {
        expect(serviceSlugs.has(slug), `${industry.slug}: ${slug}`).toBe(true);
      }
    }
  });

  it("references only real project slugs in case studies", () => {
    for (const industry of industries) {
      for (const slug of industry.caseStudies ?? []) {
        expect(projectSlugs.has(slug), `${industry.slug}: ${slug}`).toBe(true);
      }
    }
  });

  it("does not claim a case study from another industry", () => {
    for (const industry of industries) {
      for (const slug of industry.caseStudies ?? []) {
        const project = projects.find((item) => item.slug === slug);
        if (project?.industry) {
          expect(project.industry, `${industry.slug}: ${slug}`).toBe(
            industry.slug,
          );
        }
      }
    }
  });

  it("keeps every industry FAQ answer between 25 and 60 words", () => {
    for (const industry of industries) {
      for (const faq of industry.faqs ?? []) {
        const count = wordCount(faq.answer);
        expect(
          count,
          `${industry.slug}: ${faq.question}`,
        ).toBeGreaterThanOrEqual(25);
        expect(count, `${industry.slug}: ${faq.question}`).toBeLessThanOrEqual(
          60,
        );
      }
    }
  });
});
