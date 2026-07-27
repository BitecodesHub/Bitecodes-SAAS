import { describe, expect, it } from "vitest";
import {
  buildDedupeKey,
  cleanText,
  composeAddress,
  foldName,
  normalizeCountryCode,
  normalizeEmail,
  normalizeOverpassElement,
  normalizeOverpassElements,
  normalizePhone,
  normalizeWebsiteValue,
  readCoordinates,
  type OverpassElement,
} from "@/lib/prospecting/normalize";

function element(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: "node",
    id: 1,
    lat: 23.0225,
    lon: 72.5714,
    tags: { name: "Café Rossi", amenity: "restaurant" },
    ...overrides,
  };
}

describe("normalizeWebsiteValue", () => {
  it("accepts an absolute https url", () => {
    expect(normalizeWebsiteValue("https://example.com/menu")).toEqual({
      kind: "site",
      url: "https://example.com/menu",
    });
  });

  it("adds a scheme to a bare domain", () => {
    expect(normalizeWebsiteValue("example.com")).toEqual({
      kind: "site",
      url: "https://example.com/",
    });
  });

  it("repairs a protocol-relative url", () => {
    expect(normalizeWebsiteValue("//example.com").url).toBe(
      "https://example.com/",
    );
  });

  it("keeps http rather than silently upgrading it", () => {
    // The classifier needs to know the site is unencrypted; rewriting the
    // scheme here would hide a real finding.
    expect(normalizeWebsiteValue("http://example.com").url).toBe(
      "http://example.com/",
    );
  });

  it("takes the first entry of a semicolon list", () => {
    expect(normalizeWebsiteValue("a.example.com;b.example.com").url).toBe(
      "https://a.example.com/",
    );
  });

  it("strips a fragment", () => {
    expect(normalizeWebsiteValue("https://example.com/#top").url).toBe(
      "https://example.com/",
    );
  });

  it("rejects non-http schemes", () => {
    for (const value of [
      "tel:+919428767709",
      "mailto:a@example.com",
      "javascript:alert(1)",
      "ftp://example.com",
      "file:///etc/passwd",
    ]) {
      expect(normalizeWebsiteValue(value)).toEqual({
        kind: "invalid",
        url: null,
      });
    }
  });

  it("rejects free text rather than guessing a host", () => {
    for (const value of ["ask at reception", "none", "n/a", "coming soon"]) {
      expect(normalizeWebsiteValue(value).kind).toBe("invalid");
    }
  });

  it("rejects a hostname with no dot", () => {
    expect(normalizeWebsiteValue("http://localhost/").kind).toBe("invalid");
  });

  it("rejects empty and oversized values", () => {
    expect(normalizeWebsiteValue(undefined).kind).toBe("invalid");
    expect(normalizeWebsiteValue("  ").kind).toBe("invalid");
    expect(normalizeWebsiteValue(`https://e.com/${"a".repeat(600)}`).kind).toBe(
      "invalid",
    );
  });

  it("classifies social and link-in-bio pages as social, not a website", () => {
    for (const value of [
      "https://www.facebook.com/rossi",
      "https://m.facebook.com/rossi",
      "https://instagram.com/rossi",
      "https://linktr.ee/rossi",
      "https://wa.me/919428767709",
      "https://rossi.business.site",
      "https://sites.google.com/view/rossi",
      "https://rossi.wixsite.com/home",
      "https://rossi.blogspot.com",
    ]) {
      expect(normalizeWebsiteValue(value).kind).toBe("social");
    }
  });

  it("does not misclassify a real domain that merely contains a social name", () => {
    expect(normalizeWebsiteValue("https://facebook-marketing.co").kind).toBe(
      "site",
    );
    expect(normalizeWebsiteValue("https://notfacebook.com").kind).toBe("site");
  });
});

describe("normalizePhone", () => {
  it("keeps an international number in E.164 form", () => {
    expect(normalizePhone("+91 94287 67709")).toBe("+919428767709");
    expect(normalizePhone("+91-94287-67709")).toBe("+919428767709");
  });

  it("keeps a local number without inventing a country code", () => {
    expect(normalizePhone("079 2630 1234")).toBe("07926301234");
  });

  it("takes the first of several numbers", () => {
    expect(normalizePhone("+919428767709;+919999999999")).toBe("+919428767709");
  });

  it("rejects too-short and too-long values", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("  ")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Hello@Example.COM ")).toBe("hello@example.com");
  });

  it("strips a mailto prefix", () => {
    expect(normalizeEmail("mailto:hi@example.com")).toBe("hi@example.com");
  });

  it("takes the first of a list", () => {
    expect(normalizeEmail("a@example.com;b@example.com")).toBe("a@example.com");
  });

  it("rejects malformed addresses", () => {
    for (const value of [
      "not-an-email",
      "a@b",
      "a@@b.com",
      "a b@example.com",
      "@example.com",
      "a@example..com",
      "<a@example.com>",
    ]) {
      expect(normalizeEmail(value)).toBeNull();
    }
  });

  it("rejects an over-long address", () => {
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });
});

describe("cleanText", () => {
  it("collapses whitespace", () => {
    expect(cleanText("  Café   Rossi \n", 100)).toBe("Café Rossi");
  });

  it("truncates to the bound", () => {
    expect(cleanText("a".repeat(20), 5)).toBe("aaaaa");
  });

  it("returns null for blank input", () => {
    expect(cleanText("   ", 10)).toBeNull();
    expect(cleanText(undefined, 10)).toBeNull();
  });
});

describe("foldName", () => {
  it("strips diacritics, punctuation, and legal suffixes", () => {
    expect(foldName("Café Rossi Pvt. Ltd.")).toBe("cafe rossi");
    expect(foldName("Rossi & Sons")).toBe("rossi and sons");
  });

  it("collapses two spellings of the same business to one key", () => {
    expect(foldName("CAFÉ ROSSI")).toBe(foldName("cafe rossi"));
  });
});

describe("buildDedupeKey", () => {
  it("treats a sub-100-metre difference as the same business", () => {
    expect(buildDedupeKey("Rossi", 23.02251, 72.57141)).toBe(
      buildDedupeKey("Rossi", 23.0225, 72.5714),
    );
  });

  it("separates two businesses of the same name in different places", () => {
    expect(buildDedupeKey("Rossi", 23.0225, 72.5714)).not.toBe(
      buildDedupeKey("Rossi", 19.076, 72.8777),
    );
  });

  it("separates different businesses at the same address", () => {
    expect(buildDedupeKey("Rossi", 23.0225, 72.5714)).not.toBe(
      buildDedupeKey("Bianchi", 23.0225, 72.5714),
    );
  });
});

describe("readCoordinates", () => {
  it("reads a node's own point", () => {
    expect(readCoordinates(element())).toEqual({ lat: 23.0225, lng: 72.5714 });
  });

  it("falls back to a way's centre", () => {
    expect(
      readCoordinates({
        type: "way",
        id: 2,
        center: { lat: 1, lon: 2 },
      }),
    ).toEqual({ lat: 1, lng: 2 });
  });

  it("returns null when coordinates are missing or out of range", () => {
    expect(readCoordinates({ type: "way", id: 2 })).toBeNull();
    expect(
      readCoordinates({ type: "node", id: 2, lat: 91, lon: 0 }),
    ).toBeNull();
    expect(
      readCoordinates({ type: "node", id: 2, lat: 0, lon: -181 }),
    ).toBeNull();
    expect(
      readCoordinates({ type: "node", id: 2, lat: Number.NaN, lon: 0 }),
    ).toBeNull();
  });
});

describe("composeAddress", () => {
  it("joins house number and street", () => {
    expect(
      composeAddress({
        "addr:housenumber": "12",
        "addr:street": "CG Road",
        "addr:suburb": "Navrangpura",
      }),
    ).toBe("12 CG Road, Navrangpura");
  });

  it("falls back to addr:full", () => {
    expect(composeAddress({ "addr:full": "12 CG Road, Ahmedabad" })).toBe(
      "12 CG Road, Ahmedabad",
    );
  });

  it("returns null with no address tags", () => {
    expect(composeAddress({})).toBeNull();
  });
});

describe("normalizeCountryCode", () => {
  it("accepts a two-letter code", () => {
    expect(normalizeCountryCode("in")).toBe("IN");
  });

  it("rejects anything else", () => {
    expect(normalizeCountryCode("India")).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});

describe("normalizeOverpassElement", () => {
  it("maps a complete element", () => {
    const result = normalizeOverpassElement(
      element({
        tags: {
          name: "Café Rossi",
          amenity: "restaurant",
          website: "rossi.example.com",
          phone: "+91 94287 67709",
          "contact:email": "Hi@Rossi.example.com",
          "addr:housenumber": "12",
          "addr:street": "CG Road",
          "addr:city": "Ahmedabad",
          "addr:state": "Gujarat",
          "addr:postcode": "380009",
          "addr:country": "in",
        },
      }),
    );

    expect(result).toEqual({
      sourceId: "node/1",
      dedupeKey: "cafe rossi|23.023|72.571",
      name: "Café Rossi",
      category: "amenity=restaurant",
      categoryId: "food-drink",
      categoryLabel: "Restaurant",
      phone: "+919428767709",
      email: "hi@rossi.example.com",
      website: "https://rossi.example.com/",
      socialUrl: null,
      address: "12 CG Road",
      city: "Ahmedabad",
      region: "Gujarat",
      postcode: "380009",
      countryCode: "IN",
      lat: 23.0225,
      lng: 72.5714,
    });
  });

  it("routes a facebook-only presence to socialUrl, leaving website null", () => {
    const result = normalizeOverpassElement(
      element({ tags: { name: "Rossi", website: "facebook.com/rossi" } }),
    );
    expect(result?.website).toBeNull();
    expect(result?.socialUrl).toBe("https://facebook.com/rossi");
  });

  it("prefers a real website over a social page when both are tagged", () => {
    const result = normalizeOverpassElement(
      element({
        tags: {
          name: "Rossi",
          website: "https://rossi.example.com",
          "contact:facebook": "https://facebook.com/rossi",
        },
      }),
    );
    expect(result?.website).toBe("https://rossi.example.com/");
    expect(result?.socialUrl).toBeNull();
  });

  it("reads a social tag when no website tag exists", () => {
    const result = normalizeOverpassElement(
      element({
        tags: { name: "Rossi", "contact:facebook": "facebook.com/rossi" },
      }),
    );
    expect(result?.socialUrl).toBe("https://facebook.com/rossi");
  });

  it("rejects an element with no name", () => {
    expect(
      normalizeOverpassElement(element({ tags: { amenity: "restaurant" } })),
    ).toBeNull();
    expect(
      normalizeOverpassElement(element({ tags: { name: "   " } })),
    ).toBeNull();
  });

  it("rejects an element with no usable coordinates", () => {
    expect(
      normalizeOverpassElement({
        type: "way",
        id: 5,
        tags: { name: "Rossi" },
      }),
    ).toBeNull();
  });

  it("builds the source id from type and id", () => {
    expect(
      normalizeOverpassElement(
        element({ type: "way", id: 987, lat: 1, lon: 2 }),
      )?.sourceId,
    ).toBe("way/987");
  });
});

describe("normalizeOverpassElements", () => {
  it("drops unusable rows and reports how many", () => {
    const { prospects, skipped } = normalizeOverpassElements([
      element({ id: 1 }),
      element({ id: 2, tags: { amenity: "restaurant" } }),
      { type: "way", id: 3, tags: { name: "No coords" } },
    ]);
    expect(prospects).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("collapses the node and the building way for one business", () => {
    // Overpass returns both when a café is mapped as a point inside its own
    // building. Writing both would create a duplicate prospect.
    const { prospects, skipped } = normalizeOverpassElements([
      element({ type: "node", id: 1, tags: { name: "Rossi" } }),
      {
        type: "way",
        id: 2,
        center: { lat: 23.02252, lon: 72.57142 },
        tags: { name: "Rossi" },
      },
    ]);
    expect(prospects).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("keeps the richer of two duplicates", () => {
    const { prospects } = normalizeOverpassElements([
      element({ id: 1, tags: { name: "Rossi" } }),
      element({
        id: 2,
        tags: {
          name: "Rossi",
          website: "https://rossi.example.com",
          "contact:email": "hi@rossi.example.com",
        },
      }),
    ]);
    expect(prospects).toHaveLength(1);
    expect(prospects[0]!.email).toBe("hi@rossi.example.com");
  });

  it("keeps the richer duplicate regardless of arrival order", () => {
    const rich = element({
      id: 2,
      tags: { name: "Rossi", "contact:email": "hi@rossi.example.com" },
    });
    const poor = element({ id: 1, tags: { name: "Rossi" } });
    expect(normalizeOverpassElements([rich, poor]).prospects[0]!.email).toBe(
      "hi@rossi.example.com",
    );
    expect(normalizeOverpassElements([poor, rich]).prospects[0]!.email).toBe(
      "hi@rossi.example.com",
    );
  });

  it("handles an empty response", () => {
    expect(normalizeOverpassElements([])).toEqual({
      prospects: [],
      skipped: 0,
    });
  });
});
