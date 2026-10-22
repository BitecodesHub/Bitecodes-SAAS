import { describe, expect, it } from "vitest";
import {
  titleTokens,
  titlesAreNearDuplicate,
} from "@/lib/server/blog/duplicates";

describe("blog title duplicate detection", () => {
  it("catches the partner-selection pair that was published twice", () => {
    expect(
      titlesAreNearDuplicate(
        "What to look for in a web application development partner",
        "How to choose a web application development partner",
      ),
    ).toBe(true);
  });

  it("catches the same topic with different pricing angles", () => {
    expect(
      titlesAreNearDuplicate(
        "Cloud hosting choices for a growing SaaS: cost, control, and lock-in",
        "Cloud hosting for a growing SaaS: cost and control",
      ),
    ).toBe(true);
  });

  it("ignores punctuation and case when comparing titles", () => {
    expect(
      titlesAreNearDuplicate(
        "Cloud hosting choices for a growing SaaS",
        "Cloud hosting choices, for a growing SaaS!",
      ),
    ).toBe(true);
  });

  it("keeps genuinely distinct topics apart", () => {
    expect(
      titlesAreNearDuplicate(
        "How to choose a software development company for a SaaS product in 2026",
        "Cloud cost optimisation for small engineering teams",
      ),
    ).toBe(false);

    expect(
      titlesAreNearDuplicate(
        "AI integration for small businesses: where it pays off and where it does not",
        "AI chatbots for customer support: a realistic cost and quality guide",
      ),
    ).toBe(false);
  });

  it("returns false for empty or stop-word-only titles", () => {
    expect(titlesAreNearDuplicate("", "")).toBe(false);
    expect(titlesAreNearDuplicate("how to the a", "the and for")).toBe(false);
  });

  it("stems plural and progressive forms to the same tokens", () => {
    expect(titleTokens("hosting strategies")).toEqual(
      titleTokens("host strategy"),
    );
  });
});
