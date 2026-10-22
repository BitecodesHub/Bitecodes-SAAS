import { describe, expect, it } from "vitest";
import {
  ANALYTICS_BATCH_SIZE,
  analyticsAllowed,
  cleanEventName,
  clientUtm,
} from "@/lib/analytics-client";

describe("analytics client helpers", () => {
  it("normalises human-written data-track values into event names", () => {
    expect(cleanEventName("  CTA Click! ")).toBe("cta_click");
    expect(cleanEventName("form_start:v2")).toBe("form_start:v2");
    expect(cleanEventName("service--audit__click")).toBe(
      "service--audit_click",
    );
    expect(cleanEventName("!!!")).toBeNull();
    expect(cleanEventName("x".repeat(100))).toHaveLength(80);
  });

  it("converts attribution into campaign fields and drops empty records", () => {
    expect(
      clientUtm({
        utmSource: "linkedin",
        utmMedium: "social",
        utmCampaign: "launch",
        utmTerm: null,
        utmContent: "hero",
      }),
    ).toEqual({
      source: "linkedin",
      medium: "social",
      campaign: "launch",
      term: null,
      content: "hero",
    });

    expect(
      clientUtm({
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
      }),
    ).toBeNull();
    expect(clientUtm(null)).toBeNull();
  });

  it("stays off without a browser and keeps the server batch ceiling", () => {
    expect(analyticsAllowed()).toBe(false);
    expect(ANALYTICS_BATCH_SIZE).toBe(20);
  });
});
