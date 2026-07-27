import { describe, expect, it } from "vitest";
import {
  DnsResolutionError,
  isPublicIp,
  normalizeAuditUrl,
} from "@/lib/server/safe-url";

describe("normalizeAuditUrl", () => {
  it("defaults a hostname to HTTPS", () => {
    expect(normalizeAuditUrl("example.com/path#section").toString()).toBe(
      "https://example.com/path",
    );
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:secret@example.com",
    "http://example.com:8080",
    "http://localhost",
    "http://service.internal",
    "http://printer.local",
  ])("blocks unsafe URL %s", (input) => {
    expect(() => normalizeAuditUrl(input)).toThrow();
  });
});

describe("isPublicIp", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])("rejects private or reserved IP %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts public IP %s",
    (address) => {
      expect(isPublicIp(address)).toBe(true);
    },
  );
});

describe("DnsResolutionError", () => {
  it("marks an authoritative NXDOMAIN as the domain being missing", () => {
    const error = new DnsResolutionError("gone", true);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DnsResolutionError");
    expect(error.domainMissing).toBe(true);
  });

  it("marks a resolver failure as inconclusive", () => {
    // The distinction that stops a flaky resolver mass-labelling healthy
    // prospects as "website down".
    expect(new DnsResolutionError("timeout", false).domainMissing).toBe(false);
  });
});
