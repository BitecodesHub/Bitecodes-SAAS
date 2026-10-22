import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_STORAGE_KEY,
  captureAttribution,
  cleanAttributionValue,
  cleanLandingPath,
  parseAttribution,
  readAttribution,
  referrerHostOf,
  sanitizeAttribution,
  type AttributionStorage,
} from "@/lib/attribution";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: AttributionStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, data };
}

const throwingStorage: AttributionStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

const now = new Date("2026-10-18T10:00:00.000Z");

describe("parseAttribution", () => {
  it("captures utm parameters, referrer host, and landing path", () => {
    const a = parseAttribution({
      search:
        "?utm_source=linkedin&utm_medium=social&utm_campaign=audit-oct&utm_term=web+design&utm_content=post-1&ref=x",
      referrer: "https://www.linkedin.com/feed/?trk=abc",
      pathname: "/website-audit",
      host: "www.bitecodes.com",
      now,
    });
    expect(a).toEqual({
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "audit-oct",
      utmTerm: "web design",
      utmContent: "post-1",
      referrerHost: "www.linkedin.com",
      landingPath: "/website-audit",
      firstSeenAt: "2026-10-18T10:00:00.000Z",
    });
  });

  it("records a direct visit with nulls", () => {
    const a = parseAttribution({
      search: "",
      referrer: "",
      pathname: "/",
      host: "www.bitecodes.com",
      now,
    });
    expect(a.utmSource).toBeNull();
    expect(a.referrerHost).toBeNull();
    expect(a.landingPath).toBe("/");
  });

  it("drops values that look like personal data", () => {
    const a = parseAttribution({
      search: "?utm_source=jane@example.com&utm_term=%2B61%20400%20123%20456",
      referrer: null,
      pathname: "/",
      host: null,
      now,
    });
    expect(a.utmSource).toBeNull();
    expect(a.utmTerm).toBeNull();
  });
});

describe("helpers", () => {
  it("keeps only the referrer host and ignores same-site referrers", () => {
    expect(referrerHostOf("https://google.com/search?q=x")).toBe("google.com");
    expect(
      referrerHostOf("https://bitecodes.com/about", "www.bitecodes.com"),
    ).toBeNull();
    expect(referrerHostOf("android-app://com.x")).toBeNull();
    expect(referrerHostOf("not a url")).toBeNull();
    expect(referrerHostOf(null)).toBeNull();
  });

  it("strips query and fragment from the landing path", () => {
    expect(cleanLandingPath("/pricing?email=a@b.com#x")).toBe("/pricing");
    expect(cleanLandingPath("pricing")).toBeNull();
    expect(cleanLandingPath("/" + "a".repeat(400))?.length).toBe(200);
  });

  it("bounds and filters values", () => {
    expect(cleanAttributionValue("  google  ")).toBe("google");
    expect(cleanAttributionValue("x".repeat(300))?.length).toBe(100);
    expect(cleanAttributionValue("<script>")).toBeNull();
    expect(cleanAttributionValue(42)).toBeNull();
    expect(cleanAttributionValue("")).toBeNull();
  });

  it("sanitises an untrusted record", () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution("x")).toBeNull();
    expect(sanitizeAttribution([])).toBeNull();
    const clean = sanitizeAttribution({
      utmSource: "google",
      utmMedium: "a@b.com",
      referrerHost: "evil.com/path?x=1",
      landingPath: "/x?y=z",
      firstSeenAt: "garbage",
      extra: "dropped",
    });
    expect(clean).toEqual({
      utmSource: "google",
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      referrerHost: null,
      landingPath: "/x",
      firstSeenAt: new Date(0).toISOString(),
    });
  });
});

describe("captureAttribution", () => {
  const location = {
    search: "?utm_source=newsletter",
    pathname: "/blog/post",
    host: "www.bitecodes.com",
  };

  it("stores the first touch and returns it", () => {
    const { storage, data } = memoryStorage();
    const first = captureAttribution({
      storage,
      location,
      referrer: "https://news.ycombinator.com/",
      now,
    });
    expect(first?.utmSource).toBe("newsletter");
    expect(first?.referrerHost).toBe("news.ycombinator.com");
    expect(JSON.parse(data.get(ATTRIBUTION_STORAGE_KEY)!)).toEqual(first);
    expect(readAttribution(storage)).toEqual(first);
  });

  it("never overwrites an existing first touch", () => {
    const { storage } = memoryStorage();
    const first = captureAttribution({ storage, location, now });
    const second = captureAttribution({
      storage,
      location: { search: "?utm_source=google", pathname: "/", host: "x" },
      now: new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(second).toEqual(first);
  });

  it("works when storage throws, returning the visit without saving", () => {
    const a = captureAttribution({ storage: throwingStorage, location, now });
    expect(a?.utmSource).toBe("newsletter");
    expect(readAttribution(throwingStorage)).toBeNull();
  });

  it("works with no storage at all", () => {
    expect(
      captureAttribution({ storage: null, location, now })?.landingPath,
    ).toBe("/blog/post");
  });

  it("returns null outside a browser when no location is given", () => {
    expect(captureAttribution({ storage: null })).toBeNull();
    expect(readAttribution()).toBeNull();
  });

  it("ignores corrupt stored JSON", () => {
    const { storage } = memoryStorage({ [ATTRIBUTION_STORAGE_KEY]: "{oops" });
    expect(readAttribution(storage)).toBeNull();
    const fresh = captureAttribution({ storage, location, now });
    expect(fresh?.utmSource).toBe("newsletter");
  });
});
