import { describe, expect, it } from "vitest";
import {
  buildProposalPricing,
  MAINTENANCE_KEY,
  MAINTENANCE_SERVICE_SLUG,
  PROPOSAL_MAX_QUANTITY,
} from "@/lib/proposals/pricing";
import { convertPrice, getPricing } from "@/lib/pricing";

const base = {
  currency: "USD" as const,
  includeMaintenance: false,
  maintenanceMonths: 3,
  milestoneCount: 2,
};

describe("proposal pricing", () => {
  it("prices lines from the published floor, not from the request", () => {
    const pricing = buildProposalPricing({
      ...base,
      selections: [
        { serviceSlug: "website-development", quantity: 2 },
        { serviceSlug: "technical-consulting", quantity: 4 },
      ],
    });

    expect(pricing.lineItems).toHaveLength(2);
    expect(pricing.lineItems[0]).toMatchObject({
      key: "website-development",
      quantity: 2,
      unitAmount: 500,
      amount: 1_000,
    });
    expect(pricing.lineItems[1]).toMatchObject({
      key: "technical-consulting",
      quantity: 4,
      unitAmount: 60,
      amount: 240,
    });
    expect(pricing.total).toBe(1_240);
  });

  it("ignores unknown services and clamps hostile quantities", () => {
    const pricing = buildProposalPricing({
      ...base,
      selections: [
        { serviceSlug: "not-a-service", quantity: 99 },
        { serviceSlug: "website-development", quantity: 0 },
        { serviceSlug: "website-development", quantity: 500 },
      ],
    });

    expect(pricing.lineItems).toHaveLength(1);
    expect(pricing.lineItems[0]?.quantity).toBe(PROPOSAL_MAX_QUANTITY);
    expect(pricing.lineItems[0]?.amount).toBe(500 * PROPOSAL_MAX_QUANTITY);
  });

  it("converts the published floor into the proposal currency", () => {
    const pricing = buildProposalPricing({
      ...base,
      currency: "INR",
      selections: [{ serviceSlug: "saas-development", quantity: 1 }],
    });

    expect(pricing.lineItems[0]?.unitAmount).toBe(
      convertPrice(getPricing("saas-development")!.startingFromUSD, "INR"),
    );
    expect(pricing.total).toBe(pricing.lineItems[0]?.unitAmount);
  });

  it("suggests the retainer unless it is already included", () => {
    const suggested = buildProposalPricing({
      ...base,
      selections: [{ serviceSlug: "website-development", quantity: 1 }],
    });
    expect(suggested.retainerUpsell?.serviceSlug).toBe(
      MAINTENANCE_SERVICE_SLUG,
    );
    expect(suggested.retainerUpsell?.months).toBe(3);
    expect(suggested.lineItems.map((line) => line.key)).not.toContain(
      MAINTENANCE_KEY,
    );

    const included = buildProposalPricing({
      ...base,
      includeMaintenance: true,
      maintenanceMonths: 6,
      selections: [{ serviceSlug: "website-development", quantity: 1 }],
    });
    expect(included.retainerUpsell).toBeNull();
    expect(
      included.lineItems.find((line) => line.key === MAINTENANCE_KEY),
    ).toMatchObject({
      quantity: 6,
      unitAmount: 300,
      amount: 1_800,
    });
  });

  it("does not suggest a retainer on an empty proposal", () => {
    const pricing = buildProposalPricing({
      ...base,
      selections: [{ serviceSlug: "not-a-service", quantity: 1 }],
    });
    expect(pricing.lineItems).toEqual([]);
    expect(pricing.total).toBe(0);
    expect(pricing.retainerUpsell).toBeNull();
  });
});
