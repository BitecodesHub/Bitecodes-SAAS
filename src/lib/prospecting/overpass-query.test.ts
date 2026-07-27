import { describe, expect, it } from "vitest";
import {
  PROSPECT_CATEGORIES,
  PROSPECT_CATEGORY_IDS,
  describeOsmTags,
  humanizeTagValue,
  normalizeCategoryIds,
} from "@/lib/prospecting/categories";
import {
  RADIUS_LIMITS,
  RESULT_LIMITS,
  buildOverpassQuery,
  clampLimit,
  clampRadius,
  formatCoordinate,
  overpassCacheKey,
  renderTagFilter,
} from "@/lib/prospecting/overpass-query";

describe("category catalogue", () => {
  it("has unique ids", () => {
    expect(new Set(PROSPECT_CATEGORY_IDS).size).toBe(
      PROSPECT_CATEGORY_IDS.length,
    );
  });

  it("declares at least one filter per category", () => {
    for (const category of PROSPECT_CATEGORIES) {
      expect(category.filters.length).toBeGreaterThan(0);
    }
  });

  it("uses only tag keys and values the query builder accepts", () => {
    // The builder throws on unsafe characters. Asserting here means a typo in
    // the catalogue fails a fast unit test instead of a live Overpass call.
    for (const category of PROSPECT_CATEGORIES) {
      for (const filter of category.filters) {
        expect(() => renderTagFilter(filter)).not.toThrow();
      }
    }
  });

  it("never repeats a tag value within one category", () => {
    for (const category of PROSPECT_CATEGORIES) {
      for (const filter of category.filters) {
        expect(new Set(filter.values).size).toBe(filter.values.length);
      }
    }
  });
});

describe("normalizeCategoryIds", () => {
  it("drops unknown ids", () => {
    expect(normalizeCategoryIds(["food-drink", "not-a-category"])).toEqual([
      "food-drink",
    ]);
  });

  it("de-duplicates", () => {
    expect(normalizeCategoryIds(["retail", "retail"])).toEqual(["retail"]);
  });

  it("returns catalogue order regardless of input order", () => {
    const reversed = [...PROSPECT_CATEGORY_IDS].reverse();
    expect(normalizeCategoryIds(reversed)).toEqual(PROSPECT_CATEGORY_IDS);
  });

  it("returns empty for empty input", () => {
    expect(normalizeCategoryIds([])).toEqual([]);
  });
});

describe("describeOsmTags", () => {
  it("resolves a catalogue value to its category", () => {
    expect(describeOsmTags({ amenity: "restaurant", name: "Rossi" })).toEqual({
      categoryId: "food-drink",
      categoryLabel: "Restaurant",
      rawCategory: "amenity=restaurant",
    });
  });

  it("matches wildcard families where the catalogue lists no values", () => {
    // `craft=*` — the catalogue intentionally accepts any craft value.
    expect(describeOsmTags({ craft: "electrician" })).toEqual({
      categoryId: "trades",
      categoryLabel: "Electrician",
      rawCategory: "craft=electrician",
    });
  });

  it("keeps the raw tag for a named business outside the catalogue", () => {
    const result = describeOsmTags({ amenity: "post_box" });
    expect(result.categoryId).toBeNull();
    expect(result.categoryLabel).toBe("Post box");
    expect(result.rawCategory).toBe("amenity=post_box");
  });

  it("returns nulls when no recognisable key is present", () => {
    expect(describeOsmTags({ name: "Mystery" })).toEqual({
      categoryId: null,
      categoryLabel: null,
      rawCategory: null,
    });
  });

  it("does not match a value that merely contains a catalogue value", () => {
    // `restaurant_supply` must not be read as `restaurant`.
    expect(
      describeOsmTags({ shop: "restaurant_supply" }).categoryId,
    ).toBeNull();
  });
});

describe("humanizeTagValue", () => {
  it("replaces underscores and capitalises", () => {
    expect(humanizeTagValue("fast_food")).toBe("Fast food");
  });

  it("handles multi-value tags", () => {
    expect(humanizeTagValue("cafe;bar")).toBe("Cafe bar");
  });

  it("returns empty string for empty input", () => {
    expect(humanizeTagValue("")).toBe("");
    expect(humanizeTagValue("__")).toBe("");
  });
});

describe("clampRadius", () => {
  it("clamps to the documented bounds", () => {
    expect(clampRadius(10)).toBe(RADIUS_LIMITS.min);
    expect(clampRadius(999_999)).toBe(RADIUS_LIMITS.max);
    expect(clampRadius(1_500)).toBe(1_500);
  });

  it("falls back to the default for non-numbers", () => {
    expect(clampRadius(Number.NaN)).toBe(RADIUS_LIMITS.default);
    expect(clampRadius(Number.POSITIVE_INFINITY)).toBe(RADIUS_LIMITS.default);
  });

  it("rounds fractional metres", () => {
    expect(clampRadius(1_500.6)).toBe(1_501);
  });
});

describe("clampLimit", () => {
  it("clamps to the documented bounds", () => {
    expect(clampLimit(0)).toBe(RESULT_LIMITS.min);
    expect(clampLimit(10_000)).toBe(RESULT_LIMITS.max);
    expect(clampLimit(50)).toBe(50);
  });

  it("falls back to the default for non-numbers", () => {
    expect(clampLimit(Number.NaN)).toBe(RESULT_LIMITS.default);
  });
});

describe("formatCoordinate", () => {
  it("never emits exponent notation, which Overpass rejects", () => {
    expect(formatCoordinate(0.0000004)).toBe("0.000000");
    expect(formatCoordinate(0.0000004)).not.toContain("e");
  });

  it("keeps six decimals of precision", () => {
    expect(formatCoordinate(23.0225)).toBe("23.022500");
    expect(formatCoordinate(-72.571362)).toBe("-72.571362");
  });
});

describe("renderTagFilter", () => {
  it("uses equality for a single value", () => {
    expect(renderTagFilter({ key: "amenity", values: ["cafe"] })).toBe(
      '["amenity"="cafe"]',
    );
  });

  it("uses an anchored alternation for several values", () => {
    expect(renderTagFilter({ key: "amenity", values: ["cafe", "bar"] })).toBe(
      '["amenity"~"^(cafe|bar)$"]',
    );
  });

  it("uses existence for a wildcard family", () => {
    expect(renderTagFilter({ key: "craft", values: [] })).toBe('["craft"]');
  });

  it("accepts namespaced keys", () => {
    expect(renderTagFilter({ key: "contact:email", values: [] })).toBe(
      '["contact:email"]',
    );
  });

  it("rejects a value that would break out of the tag test", () => {
    expect(() =>
      renderTagFilter({ key: "amenity", values: ['cafe"]["foo'] }),
    ).toThrow(/Unsafe OSM tag value/);
  });

  it("rejects a key containing a quote or bracket", () => {
    expect(() => renderTagFilter({ key: 'a"]', values: [] })).toThrow(
      /Unsafe OSM tag key/,
    );
    expect(() => renderTagFilter({ key: "Amenity", values: [] })).toThrow(
      /Unsafe OSM tag key/,
    );
  });

  it("rejects a value containing a regex metacharacter", () => {
    // `.*` inside an alternation would widen the match to everything.
    expect(() => renderTagFilter({ key: "shop", values: ["a", ".*"] })).toThrow(
      /Unsafe OSM tag value/,
    );
  });
});

describe("buildOverpassQuery", () => {
  const base = {
    lat: 23.0225,
    lng: 72.5714,
    radiusMeters: 1_500,
    categoryIds: ["food-drink"],
  };

  it("emits a json header, a grouped union, and a bounded out statement", () => {
    const query = buildOverpassQuery(base);
    expect(query.startsWith("[out:json][timeout:45];")).toBe(true);
    expect(query).toContain("(\n");
    expect(query).toContain(");");
    // `body`, not `tags`: `tags` verbosity omits node coordinates, and most
    // small businesses are nodes — verified against the live API.
    expect(query.trimEnd().endsWith("out body center 200;")).toBe(true);
  });

  it("requires a name on every statement", () => {
    const query = buildOverpassQuery(base);
    const statements = query
      .split("\n")
      .filter((line) => line.trim().startsWith("nwr"));
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toContain('["name"]');
    }
  });

  it("applies the around filter with clamped radius to every statement", () => {
    const query = buildOverpassQuery({ ...base, radiusMeters: 10 });
    const statements = query
      .split("\n")
      .filter((line) => line.trim().startsWith("nwr"));
    for (const statement of statements) {
      expect(statement).toContain(
        `(around:${RADIUS_LIMITS.min},23.022500,72.571400)`,
      );
    }
  });

  it("emits one statement per filter across several categories", () => {
    const query = buildOverpassQuery({
      ...base,
      categoryIds: ["food-drink", "trades"],
    });
    const expected = ["food-drink", "trades"].reduce((total, id) => {
      const category = PROSPECT_CATEGORIES.find((entry) => entry.id === id);
      return total + (category?.filters.length ?? 0);
    }, 0);
    const statements = query
      .split("\n")
      .filter((line) => line.trim().startsWith("nwr"));
    expect(statements).toHaveLength(expected);
  });

  it("switches to the cheap count mode", () => {
    const query = buildOverpassQuery({ ...base, mode: "count" });
    // There is no `[out:count]` output format — Overpass rejects it with a
    // parse error. Counting is `out count;` inside a normal JSON query.
    expect(query.startsWith("[out:json][timeout:45];")).toBe(true);
    expect(query).not.toContain("[out:count]");
    expect(query.trimEnd().endsWith("out count;")).toBe(true);
    expect(query).not.toContain("out body");
  });

  it("only ever declares a json output format", () => {
    for (const mode of ["elements", "count"] as const) {
      const query = buildOverpassQuery({ ...base, mode });
      const formats = query.match(/\[out:([a-z]+)\]/g) ?? [];
      expect(formats).toEqual(["[out:json]"]);
    }
  });

  it("clamps the result limit", () => {
    expect(buildOverpassQuery({ ...base, limit: 9_999 })).toContain(
      `out body center ${RESULT_LIMITS.max};`,
    );
  });

  it("rejects a request with no known category", () => {
    expect(() =>
      buildOverpassQuery({ ...base, categoryIds: ["nope"] }),
    ).toThrow(/At least one known category/);
    expect(() => buildOverpassQuery({ ...base, categoryIds: [] })).toThrow(
      /At least one known category/,
    );
  });

  it("rejects out-of-range coordinates", () => {
    expect(() => buildOverpassQuery({ ...base, lat: 91 })).toThrow(
      /Latitude out of range/,
    );
    expect(() => buildOverpassQuery({ ...base, lng: -181 })).toThrow(
      /Longitude out of range/,
    );
    expect(() => buildOverpassQuery({ ...base, lat: Number.NaN })).toThrow(
      /Latitude out of range/,
    );
  });

  it("is deterministic for the same input", () => {
    expect(buildOverpassQuery(base)).toBe(buildOverpassQuery(base));
  });

  it("ignores category order, so two equivalent requests share a cache entry", () => {
    const a = buildOverpassQuery({
      ...base,
      categoryIds: ["trades", "food-drink"],
    });
    const b = buildOverpassQuery({
      ...base,
      categoryIds: ["food-drink", "trades"],
    });
    expect(a).toBe(b);
  });
});

describe("overpassCacheKey", () => {
  const base = {
    lat: 23.0225,
    lng: 72.5714,
    radiusMeters: 1_500,
    categoryIds: ["food-drink"],
  };

  it("is stable for identical input", () => {
    expect(overpassCacheKey(base)).toBe(overpassCacheKey(base));
  });

  it("treats a sub-10-metre nudge as the same search", () => {
    // 0.00002 degrees of latitude is about 2 m — not a different query.
    expect(overpassCacheKey({ ...base, lat: 23.02251 })).toBe(
      overpassCacheKey(base),
    );
  });

  it("distinguishes a materially different centre", () => {
    expect(overpassCacheKey({ ...base, lat: 23.1 })).not.toBe(
      overpassCacheKey(base),
    );
  });

  it("distinguishes radius, categories, and mode", () => {
    expect(overpassCacheKey({ ...base, radiusMeters: 3_000 })).not.toBe(
      overpassCacheKey(base),
    );
    expect(overpassCacheKey({ ...base, categoryIds: ["retail"] })).not.toBe(
      overpassCacheKey(base),
    );
    expect(overpassCacheKey({ ...base, mode: "count" })).not.toBe(
      overpassCacheKey(base),
    );
  });

  it("ignores category order", () => {
    expect(
      overpassCacheKey({ ...base, categoryIds: ["trades", "food-drink"] }),
    ).toBe(
      overpassCacheKey({ ...base, categoryIds: ["food-drink", "trades"] }),
    );
  });
});
