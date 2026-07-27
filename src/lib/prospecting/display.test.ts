import { describe, expect, it } from "vitest";
import {
  PROSPECT_PIPELINE,
  PROSPECT_STATUS_LABELS,
  TAG_SEVERITY,
  formatRadius,
  scoreBand,
  shortUrl,
  tagBadgeVariant,
  tagLabel,
  tagMarkerVariant,
} from "@/lib/prospecting/display";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";
import type { ProspectTag } from "@/lib/server/db/types";

const ALL_TAGS = Object.keys(PROSPECT_TAG_LABELS) as ProspectTag[];

describe("tag presentation coverage", () => {
  it("assigns a severity to every tag the classifier can emit", () => {
    // A missing entry would render as undefined and crash the badge.
    for (const tag of ALL_TAGS) {
      expect(TAG_SEVERITY[tag], tag).toBeDefined();
    }
  });

  it("reserves critical for genuine breakage only", () => {
    const critical = ALL_TAGS.filter((tag) => TAG_SEVERITY[tag] === "critical");
    expect(critical.sort()).toEqual(["no-website", "website-down"]);
  });

  it("labels every status in the pipeline", () => {
    for (const status of PROSPECT_PIPELINE) {
      expect(PROSPECT_STATUS_LABELS[status], status).toBeTruthy();
    }
    expect(PROSPECT_PIPELINE).toHaveLength(
      Object.keys(PROSPECT_STATUS_LABELS).length,
    );
  });

  it("has no duplicate pipeline entries", () => {
    expect(new Set(PROSPECT_PIPELINE).size).toBe(PROSPECT_PIPELINE.length);
  });
});

describe("tagLabel", () => {
  it("uses the classifier's label", () => {
    expect(tagLabel("no-website")).toBe("No website");
  });

  it("says the check has not run rather than showing a blank", () => {
    expect(tagLabel(null)).toBe("Not checked yet");
    expect(tagLabel(undefined)).toBe("Not checked yet");
  });
});

describe("tagMarkerVariant", () => {
  it("maps severity to marker colour", () => {
    expect(tagMarkerVariant("website-down")).toBe("critical");
    expect(tagMarkerVariant("not-mobile-friendly")).toBe("warning");
    expect(tagMarkerVariant("seo-gaps")).toBe("default");
    expect(tagMarkerVariant("strong-website")).toBe("good");
  });

  it("greys an unclassified prospect", () => {
    expect(tagMarkerVariant(null)).toBe("muted");
  });

  it("returns a defined variant for every tag", () => {
    for (const tag of ALL_TAGS) {
      expect(tagMarkerVariant(tag), tag).toBeTruthy();
    }
  });
});

describe("tagBadgeVariant", () => {
  it("mutes a strong website and an unclassified row", () => {
    expect(tagBadgeVariant("strong-website")).toBe("muted");
    expect(tagBadgeVariant(null)).toBe("muted");
  });

  it("highlights anything actionable", () => {
    expect(tagBadgeVariant("no-website")).toBe("default");
    expect(tagBadgeVariant("feature-upgrade")).toBe("default");
  });
});

describe("formatRadius", () => {
  it("uses kilometres above a kilometre", () => {
    expect(formatRadius(1_500)).toBe("1.5 km");
    expect(formatRadius(1_000)).toBe("1.0 km");
    expect(formatRadius(25_000)).toBe("25.0 km");
  });

  it("uses metres below a kilometre", () => {
    expect(formatRadius(800)).toBe("800 m");
    expect(formatRadius(999)).toBe("999 m");
    expect(formatRadius(100.4)).toBe("100 m");
  });
});

describe("scoreBand", () => {
  it("bands the score range", () => {
    expect(scoreBand(95).label).toBe("Hot");
    expect(scoreBand(80).label).toBe("Hot");
    expect(scoreBand(79).label).toBe("Warm");
    expect(scoreBand(60).label).toBe("Warm");
    expect(scoreBand(59).label).toBe("Cool");
    expect(scoreBand(40).label).toBe("Cool");
    expect(scoreBand(39).label).toBe("Cold");
    expect(scoreBand(0).label).toBe("Cold");
  });

  it("shows a dash for an unscored prospect", () => {
    expect(scoreBand(null).label).toBe("—");
    expect(scoreBand(undefined).label).toBe("—");
  });
});

describe("shortUrl", () => {
  it("strips scheme, www, and a trailing slash", () => {
    expect(shortUrl("https://www.rossi.example.com/")).toBe(
      "rossi.example.com",
    );
    expect(shortUrl("http://rossi.example.com/menu")).toBe(
      "rossi.example.com/menu",
    );
  });

  it("returns empty for nothing", () => {
    expect(shortUrl(null)).toBe("");
    expect(shortUrl(undefined)).toBe("");
    expect(shortUrl("")).toBe("");
  });
});
