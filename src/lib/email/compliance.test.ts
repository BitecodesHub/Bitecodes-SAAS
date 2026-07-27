import { describe, expect, it } from "vitest";
import {
  CONSENT_REQUIRED_COUNTRIES,
  domainImpliesConsentRequired,
  evaluateOutreachGate,
  isConsentRequiredCountry,
  nextSendDelayMs,
  type OutreachGateInput,
} from "@/lib/email/compliance";

describe("isConsentRequiredCountry", () => {
  it("flags EU, EEA, UK, Switzerland, and Canada", () => {
    for (const code of ["DE", "FR", "IE", "NO", "IS", "LI", "GB", "CH", "CA"]) {
      expect(isConsentRequiredCountry(code), code).toBe(true);
    }
  });

  it("does not flag opt-out jurisdictions", () => {
    for (const code of ["IN", "US", "AU", "NZ", "SG", "AE", "JP", "BR", "ZA"]) {
      expect(isConsentRequiredCountry(code), code).toBe(false);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isConsentRequiredCountry(" de ")).toBe(true);
    expect(isConsentRequiredCountry("gb")).toBe(true);
  });

  it("treats an unknown country as not requiring consent", () => {
    // Absence of data must not silently block all sending; the caller decides
    // how to treat unknowns.
    expect(isConsentRequiredCountry(null)).toBe(false);
    expect(isConsentRequiredCountry(undefined)).toBe(false);
    expect(isConsentRequiredCountry("")).toBe(false);
    expect(isConsentRequiredCountry("ZZ")).toBe(false);
  });

  it("covers all 27 EU members plus EEA, UK, CH, and CA", () => {
    expect(CONSENT_REQUIRED_COUNTRIES.size).toBe(33);
  });
});

describe("domainImpliesConsentRequired", () => {
  it("infers a jurisdiction from an unambiguous ccTLD", () => {
    for (const domain of [
      "example.de",
      "shop.example.fr",
      "example.co.uk",
      "example.ie",
      "example.ca",
    ]) {
      expect(domainImpliesConsentRequired(domain), domain).toBe(true);
    }
  });

  it("does not infer from generic or ambiguous TLDs", () => {
    // .co and .io are used generically worldwide; treating them as Colombia and
    // British Indian Ocean Territory would block legitimate sending.
    for (const domain of [
      "example.com",
      "example.net",
      "example.io",
      "example.co",
      "example.in",
      "example.com.au",
      "example.dev",
    ]) {
      expect(domainImpliesConsentRequired(domain), domain).toBe(false);
    }
  });

  it("handles missing input", () => {
    expect(domainImpliesConsentRequired(null)).toBe(false);
    expect(domainImpliesConsentRequired("")).toBe(false);
  });
});

function baseInput(
  overrides: Partial<OutreachGateInput> = {},
): OutreachGateInput {
  return {
    email: "info@example.com",
    countryCode: "IN",
    suppressed: false,
    deliverable: true,
    neverContact: false,
    domainSentToday: 0,
    globalSentToday: 0,
    perDomainDailyCap: 3,
    globalDailyCap: 150,
    blockConsentRequiredRegions: true,
    hasPostalAddress: true,
    hasUnsubscribeUrl: true,
    missingVariables: [],
    ...overrides,
  };
}

describe("evaluateOutreachGate", () => {
  it("allows a compliant send", () => {
    expect(evaluateOutreachGate(baseInput())).toEqual({
      allowed: true,
      reason: null,
      detail: null,
    });
  });

  it("blocks an undeliverable address first of all", () => {
    const result = evaluateOutreachGate(
      baseInput({ deliverable: false, suppressed: true }),
    );
    expect(result.reason).toBe("undeliverable");
  });

  it("blocks automated and abuse mailboxes", () => {
    expect(evaluateOutreachGate(baseInput({ neverContact: true })).reason).toBe(
      "never-contact",
    );
  });

  it("blocks a suppressed recipient", () => {
    expect(evaluateOutreachGate(baseInput({ suppressed: true })).reason).toBe(
      "suppressed",
    );
  });

  it("blocks consent-required jurisdictions by country", () => {
    const result = evaluateOutreachGate(baseInput({ countryCode: "DE" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("consent-required-region");
  });

  it("falls back to the email TLD when the country is unknown", () => {
    expect(
      evaluateOutreachGate(
        baseInput({ countryCode: null, email: "info@example.de" }),
      ).reason,
    ).toBe("consent-required-region");
    expect(
      evaluateOutreachGate(
        baseInput({ countryCode: null, email: "info@example.com" }),
      ).allowed,
    ).toBe(true);
  });

  it("trusts an explicit country over the TLD", () => {
    // A German-domain business that the provider places in India is not
    // blocked by the fallback heuristic.
    expect(
      evaluateOutreachGate(
        baseInput({ countryCode: "IN", email: "info@example.de" }),
      ).allowed,
    ).toBe(true);
  });

  it("permits consent-required regions when the owner overrides", () => {
    expect(
      evaluateOutreachGate(
        baseInput({ countryCode: "DE", blockConsentRequiredRegions: false }),
      ).allowed,
    ).toBe(true);
  });

  it("blocks when no postal address is configured", () => {
    // CAN-SPAM requires it, so this is a hard gate rather than a warning.
    expect(
      evaluateOutreachGate(baseInput({ hasPostalAddress: false })).reason,
    ).toBe("missing-postal-address");
  });

  it("blocks when there is no unsubscribe link", () => {
    expect(
      evaluateOutreachGate(baseInput({ hasUnsubscribeUrl: false })).reason,
    ).toBe("missing-unsubscribe");
  });

  it("blocks a template with unfilled variables", () => {
    const result = evaluateOutreachGate(
      baseInput({ missingVariables: ["businessName", "reportUrl"] }),
    );
    expect(result.reason).toBe("incomplete-template");
    expect(result.detail).toContain("businessName");
    expect(result.detail).toContain("reportUrl");
  });

  it("enforces the global daily cap", () => {
    expect(
      evaluateOutreachGate(
        baseInput({ globalSentToday: 150, globalDailyCap: 150 }),
      ).reason,
    ).toBe("global-cap");
    expect(
      evaluateOutreachGate(
        baseInput({ globalSentToday: 149, globalDailyCap: 150 }),
      ).allowed,
    ).toBe(true);
  });

  it("enforces the per-domain daily cap", () => {
    expect(
      evaluateOutreachGate(
        baseInput({ domainSentToday: 3, perDomainDailyCap: 3 }),
      ).reason,
    ).toBe("domain-cap");
    expect(
      evaluateOutreachGate(
        baseInput({ domainSentToday: 2, perDomainDailyCap: 3 }),
      ).allowed,
    ).toBe(true);
  });

  it("reports the legal reason ahead of a volume reason", () => {
    // The outbox must not say "rate limited" about a message that may never be
    // sent at all.
    const result = evaluateOutreachGate(
      baseInput({ countryCode: "FR", globalSentToday: 999 }),
    );
    expect(result.reason).toBe("consent-required-region");
  });

  it("always explains a block", () => {
    const blocked = [
      baseInput({ deliverable: false }),
      baseInput({ neverContact: true }),
      baseInput({ suppressed: true }),
      baseInput({ countryCode: "DE" }),
      baseInput({ hasPostalAddress: false }),
      baseInput({ hasUnsubscribeUrl: false }),
      baseInput({ missingVariables: ["x"] }),
      baseInput({ globalSentToday: 150 }),
      baseInput({ domainSentToday: 3 }),
    ];
    for (const input of blocked) {
      const result = evaluateOutreachGate(input);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(result.detail).toBeTruthy();
    }
  });
});

describe("nextSendDelayMs", () => {
  it("spaces sends out in order", () => {
    // Fixed random => deterministic, so ordering can be asserted.
    const delays = [0, 1, 2, 3].map((index) =>
      nextSendDelayMs(index, 90_000, () => 0.5),
    );
    expect(delays).toEqual([0, 90_000, 180_000, 270_000]);
  });

  it("never returns a negative delay", () => {
    for (const random of [0, 0.5, 1]) {
      expect(nextSendDelayMs(0, 90_000, () => random)).toBeGreaterThanOrEqual(
        0,
      );
    }
  });

  it("applies jitter within a quarter of the spacing either way", () => {
    const spacing = 90_000;
    const low = nextSendDelayMs(4, spacing, () => 0);
    const high = nextSendDelayMs(4, spacing, () => 1);
    expect(low).toBe(4 * spacing - spacing * 0.25);
    expect(high).toBe(4 * spacing + spacing * 0.25);
    // Jitter must not reorder adjacent messages by more than half a slot.
    expect(high - low).toBeLessThanOrEqual(spacing);
  });
});
