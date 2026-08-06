import { describe, expect, it } from "vitest";
import {
  hostFromOrigin,
  isOriginAllowed,
  normalizeDomainPattern,
} from "@/lib/chatbot/domains";

describe("hostFromOrigin", () => {
  it("extracts the host from a full origin", () => {
    expect(hostFromOrigin("https://App.Example.com/page")).toBe(
      "app.example.com",
    );
  });
  it("accepts a bare host", () => {
    expect(hostFromOrigin("example.com")).toBe("example.com");
  });
  it("returns null for empty or unparseable input", () => {
    expect(hostFromOrigin(null)).toBeNull();
    expect(hostFromOrigin("")).toBeNull();
    expect(hostFromOrigin("   ")).toBeNull();
  });
});

describe("normalizeDomainPattern", () => {
  it("strips scheme, path, and port and lowercases", () => {
    expect(normalizeDomainPattern("HTTPS://Example.com:443/x")).toBe(
      "example.com",
    );
  });
  it("preserves a wildcard prefix", () => {
    expect(normalizeDomainPattern("*.Company.com")).toBe("*.company.com");
  });
});

describe("isOriginAllowed", () => {
  it("denies everything when the allowlist is empty (fail closed)", () => {
    expect(isOriginAllowed("https://example.com", [])).toBe(false);
  });

  it("allows an exact host match", () => {
    expect(isOriginAllowed("https://example.com", ["example.com"])).toBe(true);
  });

  it("tolerates a leading www on either side", () => {
    expect(isOriginAllowed("https://www.example.com", ["example.com"])).toBe(
      true,
    );
    expect(isOriginAllowed("https://example.com", ["www.example.com"])).toBe(
      true,
    );
  });

  it("matches subdomains for a wildcard entry", () => {
    expect(isOriginAllowed("https://app.company.com", ["*.company.com"])).toBe(
      true,
    );
    expect(isOriginAllowed("https://a.b.company.com", ["*.company.com"])).toBe(
      true,
    );
  });

  it("does NOT match the apex for a bare wildcard", () => {
    expect(isOriginAllowed("https://company.com", ["*.company.com"])).toBe(
      false,
    );
  });

  it("matches the apex when it is also listed", () => {
    expect(
      isOriginAllowed("https://company.com", ["company.com", "*.company.com"]),
    ).toBe(true);
  });

  it("rejects a different domain", () => {
    expect(isOriginAllowed("https://evil.com", ["example.com"])).toBe(false);
  });

  it("rejects a look-alike suffix that is not a subdomain", () => {
    // notcompany.com must not match *.company.com
    expect(isOriginAllowed("https://notcompany.com", ["*.company.com"])).toBe(
      false,
    );
  });

  it("rejects an unparseable origin", () => {
    expect(isOriginAllowed(null, ["example.com"])).toBe(false);
  });
});
