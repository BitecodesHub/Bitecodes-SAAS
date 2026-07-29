import { createServer, get } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  AuditError,
  isSiteFailure,
  pinnedAddressLookup,
  type AuditFailureReason,
} from "@/lib/server/website-auditor";

/**
 * These tests guard one rule: a fetch failure on *our* side must never be
 * reported as the prospect's website being down.
 *
 * That distinction is what stops the outreach engine emailing a working
 * business to tell them their site is broken. It was found the hard way — a
 * slow network mislabelled five live sites, including a hospital's — so it is
 * pinned here rather than left to a comment.
 */

const ALL_REASONS: AuditFailureReason[] = [
  "dns",
  "refused",
  "tls",
  "server-error",
  "timeout",
  "too-large",
  "not-html",
  "blocked",
  "redirect-loop",
  "unknown",
];

describe("isSiteFailure", () => {
  it("treats only real server-side evidence as the site being down", () => {
    expect(isSiteFailure("dns")).toBe(true);
    expect(isSiteFailure("refused")).toBe(true);
    expect(isSiteFailure("tls")).toBe(true);
    expect(isSiteFailure("server-error")).toBe(true);
  });

  it("never blames the prospect for a failure on our side", () => {
    // A timeout is the dangerous one: on a slow link every large healthy page
    // hits it. The others say nothing about whether the site works either.
    expect(isSiteFailure("timeout")).toBe(false);
    expect(isSiteFailure("too-large")).toBe(false);
    expect(isSiteFailure("unknown")).toBe(false);
    expect(isSiteFailure("blocked")).toBe(false);
    expect(isSiteFailure("redirect-loop")).toBe(false);
    expect(isSiteFailure("not-html")).toBe(false);
  });

  it("classifies every declared reason one way or the other", () => {
    for (const reason of ALL_REASONS) {
      expect(typeof isSiteFailure(reason), reason).toBe("boolean");
    }
  });

  it("keeps the blaming set small and explicit", () => {
    const blaming = ALL_REASONS.filter(isSiteFailure);
    expect(blaming.sort()).toEqual(["dns", "refused", "server-error", "tls"]);
  });
});

describe("AuditError", () => {
  it("carries the reason and an optional status code", () => {
    const error = new AuditError("boom", "server-error", 503);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuditError");
    expect(error.reason).toBe("server-error");
    expect(error.statusCode).toBe(503);
  });

  it("defaults the status code to null", () => {
    expect(new AuditError("boom", "timeout").statusCode).toBeNull();
  });
});

describe("pinnedAddressLookup", () => {
  /**
   * The transport contract, pinned because breaking it is silent.
   *
   * Node requests `all` when it connects and then accepts only an array. The
   * single-address form made it reject its own lookup with
   * ERR_INVALID_IP_ADDRESS, so every reachable site failed the audit: the
   * public tool returned 502 for every URL, and prospects with a working
   * website were left permanently unclassified.
   */
  it("returns the array form Node requires when connecting", () => {
    const calls: unknown[] = [];
    pinnedAddressLookup("203.0.113.7")(
      "example.test",
      { all: true },
      (...args: unknown[]) => calls.push(args),
    );
    expect(calls).toEqual([[null, [{ address: "203.0.113.7", family: 4 }]]]);
  });

  it("still supports the single-address form", () => {
    const calls: unknown[] = [];
    pinnedAddressLookup("203.0.113.7")(
      "example.test",
      {},
      (...args: unknown[]) => calls.push(args),
    );
    expect(calls).toEqual([[null, "203.0.113.7", 4]]);
  });

  it("reports family 6 for an IPv6 address", () => {
    const calls: unknown[] = [];
    pinnedAddressLookup("2001:db8::1")(
      "example.test",
      { all: true },
      (...args: unknown[]) => calls.push(args),
    );
    expect(calls).toEqual([[null, [{ address: "2001:db8::1", family: 6 }]]]);
  });

  it("connects through a real request, proving Node accepts the shape", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<html><body>ok</body></html>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;

    try {
      const statusCode = await new Promise<number>((resolve, reject) => {
        const request = get(
          {
            hostname: "audit-contract.test",
            port,
            path: "/",
            // The production call site: a hostname that does not resolve,
            // reachable only because the lookup pins the address.
            lookup: pinnedAddressLookup("127.0.0.1"),
          },
          (response) => {
            response.resume();
            resolve(response.statusCode ?? 0);
          },
        );
        request.on("error", reject);
      });

      expect(statusCode).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
