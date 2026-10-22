import { beforeEach, describe, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import {
  MAX_SEARCH_SUBMISSION_ATTEMPTS,
  clearSearchFailures,
  dueSearchSubmissions,
  recordSearchFailures,
  retryDelayMs,
  searchSubmissionSummary,
  submissionPath,
} from "@/lib/server/search-submissions";

const NOW = new Date("2026-10-22T06:00:00.000Z");

describe("submissionPath", () => {
  it("reduces absolute URLs and query strings to a canonical path", () => {
    expect(
      submissionPath("https://www.bitecodes.com/blog/hello?utm_source=x"),
    ).toBe("/blog/hello");
    expect(submissionPath("/blog/hello/")).toBe("/blog/hello");
    expect(submissionPath("blog/hello")).toBe("/blog/hello");
    expect(submissionPath("/")).toBe("/");
  });

  it("rejects values that are not paths", () => {
    expect(submissionPath("")).toBeNull();
    expect(submissionPath("?utm_source=x")).toBeNull();
    expect(submissionPath("not a url")).toBeNull();
  });
});

describe("retryDelayMs", () => {
  it("doubles from thirty minutes and stops at one day", () => {
    expect(retryDelayMs(1)).toBe(30 * 60 * 1000);
    expect(retryDelayMs(2)).toBe(60 * 60 * 1000);
    expect(retryDelayMs(3)).toBe(2 * 60 * 60 * 1000);
    expect(retryDelayMs(8)).toBe(24 * 60 * 60 * 1000);
  });
});

describeWithDatabase("IndexNow retry state", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { searchSubmissions } = await import("@/lib/server/db/collections");
    await (await searchSubmissions()).deleteMany({});
  });

  it("makes a failure due only after its backoff", async () => {
    await recordSearchFailures(["/blog/one"], NOW, "HTTP 503");

    expect(await dueSearchSubmissions(NOW)).toEqual([]);
    expect(
      await dueSearchSubmissions(new Date(NOW.getTime() + retryDelayMs(1))),
    ).toEqual(["/blog/one"]);
    expect(await searchSubmissionSummary(NOW)).toMatchObject({
      pending: 1,
      due: 0,
      abandoned: 0,
    });
  });

  it("abandons a URL after the attempt ceiling instead of retrying forever", async () => {
    let at = NOW;
    for (
      let attempt = 1;
      attempt <= MAX_SEARCH_SUBMISSION_ATTEMPTS;
      attempt++
    ) {
      const record = await recordSearchFailures(
        ["/blog/never"],
        at,
        "HTTP 422",
      );
      if (attempt === MAX_SEARCH_SUBMISSION_ATTEMPTS) {
        expect(record).toEqual({ deferred: 0, abandoned: 1 });
      } else {
        expect(record).toEqual({ deferred: 1, abandoned: 0 });
      }
      at = new Date(at.getTime() + retryDelayMs(attempt));
    }

    expect(
      await dueSearchSubmissions(new Date(at.getTime() + 24 * 60 * 60 * 1000)),
    ).toEqual([]);
    expect(await searchSubmissionSummary(at)).toMatchObject({
      pending: 0,
      abandoned: 1,
    });
  });

  it("clears the row once a later submission is accepted", async () => {
    await recordSearchFailures(["/blog/two"], NOW, "HTTP 503");
    await clearSearchFailures(["/blog/two"]);

    expect(
      await dueSearchSubmissions(new Date(NOW.getTime() + 24 * 60 * 60 * 1000)),
    ).toEqual([]);
    expect(await searchSubmissionSummary(NOW)).toMatchObject({ pending: 0 });
  });
});
