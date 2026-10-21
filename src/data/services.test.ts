import { describe, expect, it } from "vitest";
import { services } from "@/data/services";
import { getPricing } from "@/lib/pricing";

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("services", () => {
  it("has all nineteen services with unique slugs", () => {
    expect(services).toHaveLength(19);
    const slugs = services.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every service deliverables, a timeline, audiences, outcomes, and FAQs", () => {
    for (const service of services) {
      expect(service.deliverables?.length, service.slug).toBeGreaterThanOrEqual(
        4,
      );
      expect(service.deliverables?.length, service.slug).toBeLessThanOrEqual(6);
      expect(service.timeline?.trim(), service.slug).toBeTruthy();
      expect(service.timeline?.toLowerCase(), service.slug).toContain(
        "typically",
      );
      expect(service.idealFor?.length, service.slug).toBeGreaterThanOrEqual(2);
      expect(service.idealFor?.length, service.slug).toBeLessThanOrEqual(4);
      expect(service.outcomes?.length, service.slug).toBeGreaterThanOrEqual(2);
      expect(service.faqs?.length, service.slug).toBeGreaterThanOrEqual(3);
      expect(service.faqs?.length, service.slug).toBeLessThanOrEqual(5);
    }
  });

  it("keeps every service FAQ answer between 25 and 60 words", () => {
    for (const service of services) {
      for (const faq of service.faqs ?? []) {
        const count = wordCount(faq.answer);
        expect(
          count,
          `${service.slug}: ${faq.question}`,
        ).toBeGreaterThanOrEqual(25);
        expect(count, `${service.slug}: ${faq.question}`).toBeLessThanOrEqual(
          60,
        );
      }
    }
  });

  it("has a published pricing entry for every service", () => {
    for (const service of services) {
      expect(getPricing(service.slug), service.slug).toBeDefined();
    }
  });

  it("does not repeat unbacked SLA wording", () => {
    const text = JSON.stringify(services);
    expect(text).not.toMatch(/SLA-backed/i);
    expect(text).not.toMatch(/\bSLAs?\b/);
  });
});
