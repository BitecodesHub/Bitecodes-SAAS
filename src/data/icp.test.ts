import { describe, expect, it } from "vitest";
import {
  FREE_MAIL_DOMAINS,
  ICP_DISQUALIFIERS,
  ICP_SEGMENTS,
  getIcpSegment,
  isFreeMailDomain,
} from "@/data/icp";
import { services } from "@/data/services";
import { industries } from "@/data/industries";
import { PROSPECT_CATEGORY_IDS } from "@/lib/prospecting/categories";

describe("ICP_SEGMENTS", () => {
  const serviceSlugs = services.map((s) => s.slug);
  const industrySlugs = industries.map((i) => i.slug);

  it("has unique ids and sensible weights", () => {
    const ids = ICP_SEGMENTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ICP_SEGMENTS) {
      expect(s.weight, s.id).toBeGreaterThan(0);
      expect(s.weight, s.id).toBeLessThanOrEqual(1);
      expect(s.countries.length, s.id).toBeGreaterThan(0);
    }
  });

  it("recommends only real services", () => {
    for (const s of ICP_SEGMENTS) {
      expect(s.recommendedServices.length, s.id).toBeGreaterThan(0);
      for (const slug of s.recommendedServices) {
        expect(serviceSlugs, `${s.id}: ${slug}`).toContain(slug);
      }
    }
  });

  it("references only real prospect categories and industry pages", () => {
    for (const s of ICP_SEGMENTS) {
      for (const id of s.prospectCategories) {
        expect(PROSPECT_CATEGORY_IDS, `${s.id}: ${id}`).toContain(id);
      }
      for (const slug of s.industryPages) {
        expect(industrySlugs, `${s.id}: ${slug}`).toContain(slug);
      }
    }
  });

  it("keeps keywords lowercase and gives every segment pains and topics", () => {
    for (const s of ICP_SEGMENTS) {
      expect(s.industryKeywords.length, s.id).toBeGreaterThan(3);
      for (const k of s.industryKeywords) expect(k).toBe(k.toLowerCase());
      expect(s.painSignals.length, s.id).toBeGreaterThan(2);
      expect(s.blogTopicSeeds.length, s.id).toBeGreaterThan(2);
    }
  });

  it("covers the D7 decision: India and Australia, services and self-serve", () => {
    const countries = new Set(ICP_SEGMENTS.flatMap((s) => s.countries));
    expect([...countries].sort()).toEqual(["AU", "IN"]);
    expect(ICP_SEGMENTS.some((s) => s.buyer === "self-serve")).toBe(true);
    expect(getIcpSegment("ndis-aged-care")?.countries).toEqual(["AU"]);
  });
});

describe("ICP_DISQUALIFIERS", () => {
  it("has unique ids and lowercase keywords", () => {
    const ids = ICP_DISQUALIFIERS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of ICP_DISQUALIFIERS) {
      for (const k of d.keywords) expect(k).toBe(k.toLowerCase());
    }
  });
});

describe("free mail", () => {
  it("lists lowercase unique domains", () => {
    expect(new Set(FREE_MAIL_DOMAINS).size).toBe(FREE_MAIL_DOMAINS.length);
    for (const d of FREE_MAIL_DOMAINS) expect(d).toBe(d.toLowerCase());
  });

  it("recognises addresses and domains", () => {
    expect(isFreeMailDomain("Someone@Gmail.com")).toBe(true);
    expect(isFreeMailDomain("x@bigpond.com")).toBe(true);
    expect(isFreeMailDomain("rediffmail.com")).toBe(true);
    expect(isFreeMailDomain("owner@clinic.com.au")).toBe(false);
    expect(isFreeMailDomain("")).toBe(false);
  });
});
