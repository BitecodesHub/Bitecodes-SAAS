import { describe, expect, it } from "vitest";
import {
  getResource,
  relatedResources,
  resourceCategories,
  resources,
} from "@/data/resources";
import { resourceRequestSchema } from "@/lib/resources";
import { formatPrice, getPricing } from "@/lib/pricing";

function flatten(resource: (typeof resources)[number]): string {
  return [
    ...resource.intro,
    ...resource.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
      ...(section.steps?.flatMap((step) => [step.title, step.text]) ?? []),
    ]),
    ...(resource.faqs?.flatMap((faq) => [faq.question, faq.answer]) ?? []),
  ].join("\n");
}

describe("resource guides", () => {
  it("publishes five guides with unique slugs", () => {
    expect(resources).toHaveLength(5);
    expect(new Set(resources.map((resource) => resource.slug)).size).toBe(5);
  });

  it("gives every guide real content and valid related links", () => {
    for (const resource of resources) {
      expect(resource.intro.length, resource.slug).toBeGreaterThanOrEqual(2);
      expect(resource.sections.length, resource.slug).toBeGreaterThanOrEqual(3);
      expect(resource.metaDescription.length, resource.slug).toBeGreaterThan(
        80,
      );
      expect(resource.relatedSlugs.length, resource.slug).toBeGreaterThan(0);
      for (const slug of resource.relatedSlugs) {
        expect(getResource(slug), `${resource.slug} → ${slug}`).toBeDefined();
      }
    }
  });

  it("makes each checklist worth the exchange", () => {
    const gated = resources.filter((resource) => resource.checklist);
    expect(gated).toHaveLength(5);
    for (const resource of gated) {
      expect(resource.checklist!.items.length, resource.slug).toBeGreaterThan(
        8,
      );
      expect(new Set(resource.checklist!.items).size, resource.slug).toBe(
        resource.checklist!.items.length,
      );
    }
  });

  it("keeps the cost guide in step with published pricing", () => {
    const costGuide = getResource("how-much-business-website-costs-india-2026");
    expect(costGuide).toBeDefined();
    const text = flatten(costGuide!);
    for (const slug of [
      "website-development",
      "web-applications",
      "saas-development",
      "business-automation",
      "maintenance-support",
      "technical-consulting",
      "ui-ux-development",
      "performance-optimization",
    ]) {
      const pricing = getPricing(slug);
      expect(pricing, slug).toBeDefined();
      expect(text).toContain(formatPrice(pricing!.startingFromUSD, "INR"));
    }
  });

  it("resolves related guides and categories from the same list", () => {
    for (const resource of resources) {
      expect(relatedResources(resource).map((item) => item.slug)).toEqual(
        resource.relatedSlugs,
      );
    }
    expect(resourceCategories.length).toBeGreaterThan(1);
  });
});

describe("resource request", () => {
  const valid = {
    slug: "website-launch-checklist-clinics",
    email: "Owner@Example.com",
    name: "  ",
    followUp: false,
    newsletter: false,
  };

  it("normalises an address and treats a blank name as absent", () => {
    const parsed = resourceRequestSchema.parse(valid);
    expect(parsed.email).toBe("owner@example.com");
    expect(parsed.name).toBeNull();
  });

  it("defaults both consent flags to false when they are omitted", () => {
    const parsed = resourceRequestSchema.parse({
      slug: valid.slug,
      email: valid.email,
    });
    expect(parsed.followUp).toBe(false);
    expect(parsed.newsletter).toBe(false);
  });

  it("rejects a bad address, a bad slug, and extra fields", () => {
    expect(
      resourceRequestSchema.safeParse({ ...valid, email: "nope" }).success,
    ).toBe(false);
    expect(
      resourceRequestSchema.safeParse({ ...valid, slug: "../secrets" }).success,
    ).toBe(false);
    expect(
      resourceRequestSchema.safeParse({ ...valid, admin: true }).success,
    ).toBe(false);
  });
});
