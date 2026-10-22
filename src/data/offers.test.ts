import { describe, expect, it } from "vitest";
import { discoverySprint, entryOffers, offerPackages } from "@/data/offers";
import { guarantees } from "@/data/guarantees";
import { getPricing } from "@/lib/pricing";

/**
 * Commercial copy drifts faster than code. These assertions make the two
 * places that must agree — the package cards and the published pricing floors —
 * fail loudly instead of publishing a lower price than /pricing shows.
 */

describe("productized offers", () => {
  it("never prices a package below the published service floors", () => {
    for (const offer of offerPackages) {
      const floors = offer.serviceSlugs.map((slug) => {
        const pricing = getPricing(slug);
        expect(
          pricing,
          `${offer.name} references unknown service ${slug}`,
        ).toBeDefined();
        return pricing!.startingFromUSD;
      });
      const floor = Math.max(...floors);
      expect(offer.priceUSD).toBe(floor);
    }
  });

  it("only cites guarantees that exist", () => {
    const slugs = new Set(guarantees.map((guarantee) => guarantee.slug));
    for (const offer of offerPackages) {
      for (const slug of offer.guaranteeSlugs) {
        expect(slugs.has(slug), `${offer.name} cites ${slug}`).toBe(true);
      }
    }
  });

  it("prices the discovery sprint and states the credit", () => {
    expect(discoverySprint.priceUSD).toBeGreaterThan(0);
    expect(discoverySprint.creditNote).toContain("credited");
  });

  it("lists exactly three entry offers, two of them free", () => {
    expect(entryOffers).toHaveLength(3);
    expect(
      entryOffers.filter((offer) => offer.priceLabel === "Free"),
    ).toHaveLength(2);
    expect(entryOffers.map((offer) => offer.href)).toEqual([
      "/website-audit",
      "/book-a-call",
      "#packages",
    ]);
  });
});
