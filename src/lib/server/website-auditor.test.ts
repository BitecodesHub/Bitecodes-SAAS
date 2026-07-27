import { describe, expect, it } from "vitest";
import {
  AuditError,
  isSiteFailure,
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
