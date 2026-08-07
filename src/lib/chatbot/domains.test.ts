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

  describe("loopback origins", () => {
    it("allows localhost on any port, so an integration can be developed", () => {
      expect(isOriginAllowed("http://localhost:8080", ["example.com"])).toBe(
        true,
      );
      expect(isOriginAllowed("http://localhost:3000", ["example.com"])).toBe(
        true,
      );
      expect(isOriginAllowed("https://localhost", ["example.com"])).toBe(true);
    });

    it("allows the loopback IPs and the reserved .localhost TLD", () => {
      expect(isOriginAllowed("http://127.0.0.1:5173", ["example.com"])).toBe(
        true,
      );
      expect(isOriginAllowed("http://[::1]:8080", ["example.com"])).toBe(true);
      // RFC 6761 reserves the whole TLD for loopback.
      expect(isOriginAllowed("http://app.localhost:8080", [])).toBe(true);
    });

    it("allows loopback even when no domains are configured at all", () => {
      // A brand-new bot is exactly when someone needs to see it work locally.
      expect(isOriginAllowed("http://localhost:8080", [])).toBe(true);
    });

    it("does not let a lookalike host masquerade as loopback", () => {
      for (const origin of [
        "https://localhost.attacker.com",
        "https://notlocalhost",
        "https://mylocalhost",
        "https://127.0.0.1.attacker.com",
        "https://localhosts",
      ]) {
        expect(isOriginAllowed(origin, ["example.com"])).toBe(false);
      }
    });

    it("still refuses a genuine third-party origin", () => {
      expect(
        isOriginAllowed("https://attacker.example.net", ["example.com"]),
      ).toBe(false);
    });
  });
});
