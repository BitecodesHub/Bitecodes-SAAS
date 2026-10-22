import { describe, expect, it } from "vitest";
import {
  onboardingProgress,
  isOnboardingComplete,
  creditRunway,
  upsellSuggestion,
  crossSellSuggestion,
  daysSince,
  type OwnerDoc,
} from "./index";
import type { CreditPack } from "@/lib/server/billing/packs";
import type { WalletLedgerDoc } from "@/lib/server/db/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOwner(overrides: Partial<OwnerDoc> = {}): OwnerDoc {
  return {
    emailVerifiedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    status: "active",
    company: null,
    productCount: 0,
    activityCount: 0,
    embedCount: 0,
    hasPurchasedCredits: false,
    ...overrides,
  };
}

function makeLedgerRow(delta: number, daysAgo = 1): WalletLedgerDoc {
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
  return {
    ownerId: "owner1",
    product: "chatbot",
    delta,
    kind: delta < 0 ? "deduct" : "purchase",
    balanceAfter: 0,
    subjectId: null,
    refId: null,
    expiresAt: null,
    note: null,
    createdAt,
  };
}

function makePacks(product: CreditPack["product"]): CreditPack[] {
  return [
    {
      packId: `${product}-starter`,
      product,
      label: "Starter",
      credits: 500,
      amount: 49_900,
      currency: "INR",
      blurb: "Starter pack.",
    },
    {
      packId: `${product}-growth`,
      product,
      label: "Growth",
      credits: 2_500,
      amount: 149_900,
      currency: "INR",
      blurb: "Growth pack.",
      popular: true,
    },
    {
      packId: `${product}-scale`,
      product,
      label: "Scale",
      credits: 12_500,
      amount: 499_900,
      currency: "INR",
      blurb: "Scale pack.",
    },
  ];
}

// ---------------------------------------------------------------------------
// onboardingProgress
// ---------------------------------------------------------------------------

describe("onboardingProgress", () => {
  it("returns 0 score when nothing is done", () => {
    const result = onboardingProgress(makeOwner());
    expect(result.score).toBe(0);
    expect(result.emailVerified).toBe(false);
    expect(result.firstProductCreated).toBe(false);
    expect(result.hasActivity).toBe(false);
    expect(result.embedded).toBe(false);
    expect(result.creditsPurchased).toBe(false);
  });

  it("adds 25 for verified email", () => {
    const result = onboardingProgress(
      makeOwner({ emailVerifiedAt: new Date() }),
    );
    expect(result.score).toBe(25);
    expect(result.emailVerified).toBe(true);
  });

  it("adds 25 for first product created", () => {
    const result = onboardingProgress(makeOwner({ productCount: 1 }));
    expect(result.score).toBe(25);
    expect(result.firstProductCreated).toBe(true);
  });

  it("adds 20 for activity", () => {
    const result = onboardingProgress(makeOwner({ activityCount: 5 }));
    expect(result.score).toBe(20);
    expect(result.hasActivity).toBe(true);
  });

  it("adds 15 for embedded", () => {
    const result = onboardingProgress(makeOwner({ embedCount: 1 }));
    expect(result.score).toBe(15);
    expect(result.embedded).toBe(true);
  });

  it("adds 15 for credits purchased", () => {
    const result = onboardingProgress(makeOwner({ hasPurchasedCredits: true }));
    expect(result.score).toBe(15);
    expect(result.creditsPurchased).toBe(true);
  });

  it("returns 100 when all steps complete", () => {
    const result = onboardingProgress(
      makeOwner({
        emailVerifiedAt: new Date(),
        productCount: 2,
        activityCount: 10,
        embedCount: 1,
        hasPurchasedCredits: true,
      }),
    );
    expect(result.score).toBe(100);
  });

  it("step weights sum to 100", () => {
    // 25 + 25 + 20 + 15 + 15 = 100
    const result = onboardingProgress(
      makeOwner({
        emailVerifiedAt: new Date(),
        productCount: 1,
        activityCount: 1,
        embedCount: 1,
        hasPurchasedCredits: true,
      }),
    );
    expect(result.score).toBe(100);
  });
});

describe("isOnboardingComplete", () => {
  it("returns false when score < 100", () => {
    const progress = onboardingProgress(
      makeOwner({ emailVerifiedAt: new Date() }),
    );
    expect(isOnboardingComplete(progress)).toBe(false);
  });

  it("returns true when score === 100", () => {
    const progress = onboardingProgress(
      makeOwner({
        emailVerifiedAt: new Date(),
        productCount: 1,
        activityCount: 1,
        embedCount: 1,
        hasPurchasedCredits: true,
      }),
    );
    expect(isOnboardingComplete(progress)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// creditRunway
// ---------------------------------------------------------------------------

describe("creditRunway", () => {
  it("returns burnRate 0 and null daysRemaining when no spend", () => {
    const result = creditRunway([], 1000);
    expect(result.burnRate).toBe(0);
    expect(result.daysRemaining).toBeNull();
    expect(result.balance).toBe(1000);
  });

  it("ignores credit rows (positive delta)", () => {
    const rows = [makeLedgerRow(500, 1)]; // a purchase
    const result = creditRunway(rows, 1000);
    expect(result.burnRate).toBe(0);
    expect(result.daysRemaining).toBeNull();
  });

  it("computes burn rate from debit rows", () => {
    // 300 debits spread over 30 days window → 10 per day
    const rows = [makeLedgerRow(-300, 5)];
    const result = creditRunway(rows, 1000);
    expect(result.burnRate).toBe(10); // 300 / 30
    expect(result.daysRemaining).toBe(100); // floor(1000 / 10)
  });

  it("floors daysRemaining", () => {
    // 1 debit of -1 → burnRate = 1/30 → daysRemaining = floor(100 / (1/30)) = 3000
    const rows = [makeLedgerRow(-1, 1)];
    const result = creditRunway(rows, 100);
    expect(result.daysRemaining).toBe(3000);
  });

  it("handles zero balance with active spend → 0 days", () => {
    const rows = [makeLedgerRow(-300, 10)];
    const result = creditRunway(rows, 0);
    expect(result.daysRemaining).toBe(0);
  });

  it("sums multiple debit rows", () => {
    const rows = [
      makeLedgerRow(-60, 5),
      makeLedgerRow(-90, 10),
      makeLedgerRow(-150, 20),
    ];
    const result = creditRunway(rows, 300);
    // totalSpend = 300, burnRate = 300/30 = 10, daysRemaining = floor(300/10) = 30
    expect(result.burnRate).toBe(10);
    expect(result.daysRemaining).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// upsellSuggestion
// ---------------------------------------------------------------------------

describe("upsellSuggestion", () => {
  it("returns null when burnRate is 0", () => {
    const runway = { burnRate: 0, daysRemaining: null, balance: 5000 };
    const result = upsellSuggestion(runway, makePacks("chatbot"), "chatbot");
    expect(result).toBeNull();
  });

  it("returns null when runway > 14 days", () => {
    const runway = { burnRate: 10, daysRemaining: 30, balance: 300 };
    const result = upsellSuggestion(runway, makePacks("chatbot"), "chatbot");
    expect(result).toBeNull();
  });

  it("returns a pack when runway <= 14 days", () => {
    const runway = { burnRate: 50, daysRemaining: 10, balance: 500 };
    const result = upsellSuggestion(runway, makePacks("chatbot"), "chatbot");
    expect(result).not.toBeNull();
  });

  it("returns a pack when balance is 0", () => {
    const runway = { burnRate: 100, daysRemaining: 0, balance: 0 };
    const result = upsellSuggestion(runway, makePacks("chatbot"), "chatbot");
    expect(result).not.toBeNull();
  });

  it("suggests smallest pack that covers monthly spend", () => {
    // burnRate = 10/day → monthly = 300. Starter has 500 credits, covers it.
    const runway = { burnRate: 10, daysRemaining: 5, balance: 50 };
    const packs = makePacks("chatbot");
    const result = upsellSuggestion(runway, packs, "chatbot");
    expect(result?.packId).toBe("chatbot-starter");
  });

  it("falls back to largest pack when none covers monthly spend", () => {
    // burnRate = 1000/day → monthly = 30000. None of our packs cover that.
    const runway = { burnRate: 1000, daysRemaining: 2, balance: 2000 };
    const packs = makePacks("chatbot");
    const result = upsellSuggestion(runway, packs, "chatbot");
    expect(result?.packId).toBe("chatbot-scale");
  });

  it("returns null when no packs available for product", () => {
    const runway = { burnRate: 10, daysRemaining: 5, balance: 50 };
    const result = upsellSuggestion(runway, [], "chatbot");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// crossSellSuggestion
// ---------------------------------------------------------------------------

describe("crossSellSuggestion", () => {
  it("suggests chatbot first when nothing active", () => {
    expect(crossSellSuggestion([])).toBe("chatbot");
  });

  it("suggests forms when chatbot already active", () => {
    expect(crossSellSuggestion(["chatbot"])).toBe("forms");
  });

  it("suggests bookings when chatbot+forms active", () => {
    expect(crossSellSuggestion(["chatbot", "forms"])).toBe("bookings");
  });

  it("suggests email when chatbot+forms+bookings active", () => {
    expect(crossSellSuggestion(["chatbot", "forms", "bookings"])).toBe("email");
  });

  it("returns null when all products active", () => {
    expect(
      crossSellSuggestion(["chatbot", "forms", "bookings", "email"]),
    ).toBeNull();
  });

  it("is not order-sensitive in the input array", () => {
    // chatbot and forms are active (in different order), should suggest bookings
    expect(crossSellSuggestion(["forms", "chatbot"])).toBe("bookings");
  });
});

// ---------------------------------------------------------------------------
// daysSince
// ---------------------------------------------------------------------------

describe("daysSince", () => {
  it("returns 0 for same day", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const date = new Date("2026-10-21T10:00:00Z");
    expect(daysSince(date, now)).toBe(0);
  });

  it("returns 1 for exactly 1 day ago", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const date = new Date("2026-10-20T00:00:00Z");
    expect(daysSince(date, now)).toBe(1);
  });

  it("returns 30 for 30 days ago", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const date = new Date("2026-09-21T00:00:00Z");
    expect(daysSince(date, now)).toBe(30);
  });
});
