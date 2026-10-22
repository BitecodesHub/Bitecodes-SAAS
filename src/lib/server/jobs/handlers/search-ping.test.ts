import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KEY_STATIC_PATHS,
  selectSearchPingPaths,
} from "@/lib/server/jobs/handlers/search-ping";

vi.mock("@/lib/server/settings", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/server/env", () => ({ getIndexNowKey: vi.fn() }));
vi.mock("@/lib/server/blog/repository", () => ({
  getPublishedPosts: vi.fn(),
}));
vi.mock("@/lib/server/search-ping", () => ({ pingIndexNow: vi.fn() }));
vi.mock("@/lib/server/search-submissions", () => ({
  dueSearchSubmissions: vi.fn(),
  searchSubmissionSummary: vi.fn(),
}));

import { getSettings } from "@/lib/server/settings";
import { getIndexNowKey } from "@/lib/server/env";
import { getPublishedPosts } from "@/lib/server/blog/repository";
import { pingIndexNow } from "@/lib/server/search-ping";
import {
  dueSearchSubmissions,
  searchSubmissionSummary,
} from "@/lib/server/search-submissions";
import { handleSearchPing } from "@/lib/server/jobs/handlers/search-ping";

const NOW = new Date("2026-10-19T06:00:00.000Z"); // Monday

describe("selectSearchPingPaths", () => {
  it("includes posts published or updated in the last 26 hours", () => {
    const paths = selectSearchPingPaths(
      [
        { slug: "recent", date: "2026-10-18T05:00:00.000Z" },
        {
          slug: "edited",
          date: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-10-18T12:00:00.000Z",
        },
      ],
      NOW,
    );

    expect(paths).toContain("/blog/recent");
    expect(paths).toContain("/blog/edited");
  });

  it("excludes posts older than the window", () => {
    const paths = selectSearchPingPaths(
      [
        { slug: "old", date: "2026-10-17T01:00:00.000Z" },
        { slug: "undated", date: "not-a-date" },
      ],
      NOW,
    );

    expect(paths).not.toContain("/blog/old");
    expect(paths).not.toContain("/blog/undated");
  });

  it("adds the key static pages on Monday only", () => {
    const monday = selectSearchPingPaths([], NOW);
    const tuesday = selectSearchPingPaths(
      [],
      new Date("2026-10-20T06:00:00.000Z"),
    );

    expect(monday).toEqual([...KEY_STATIC_PATHS]);
    expect(tuesday).toEqual([]);
  });

  it("returns each path once", () => {
    const paths = selectSearchPingPaths(
      [
        { slug: "one", date: "2026-10-19T12:00:00.000Z" },
        { slug: "one", date: "2026-10-19T13:00:00.000Z" },
        { slug: "two", date: "2026-10-19T14:00:00.000Z" },
      ],
      new Date("2026-10-20T06:00:00.000Z"),
    );

    expect(paths).toEqual(["/blog/one", "/blog/two"]);
  });
});

describe("handleSearchPing", () => {
  const context = {
    jobId: "job",
    attempts: 0,
    log: vi.fn(),
    deadline: Date.now() + 60_000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    vi.mocked(getSettings).mockResolvedValue({
      growth: { searchPing: true },
    } as never);
    vi.mocked(getIndexNowKey).mockReturnValue("key");
    vi.mocked(getPublishedPosts).mockResolvedValue([]);
    vi.mocked(pingIndexNow).mockResolvedValue(true);
    vi.mocked(dueSearchSubmissions).mockResolvedValue([]);
    vi.mocked(searchSubmissionSummary).mockResolvedValue({
      pending: 0,
      due: 0,
      abandoned: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips when the toggle is off", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      growth: { searchPing: false },
    } as never);

    await expect(handleSearchPing({}, context)).resolves.toEqual({
      skipped: "disabled",
    });
    expect(pingIndexNow).not.toHaveBeenCalled();
  });

  it("skips when IndexNow has no key", async () => {
    vi.mocked(getIndexNowKey).mockReturnValue(null);

    await expect(handleSearchPing({}, context)).resolves.toEqual({
      skipped: "no-key",
    });
    expect(pingIndexNow).not.toHaveBeenCalled();
  });

  it("pings the selected paths", async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([
      { slug: "new", date: "2026-10-18T05:00:00.000Z" },
    ] as never);

    const result = await handleSearchPing({}, context);

    expect(pingIndexNow).toHaveBeenCalledWith(
      expect.arrayContaining(["/blog/new"]),
    );
    expect(result).toMatchObject({ pinged: true });
  });

  it("includes URLs whose retry is due", async () => {
    vi.mocked(dueSearchSubmissions).mockResolvedValue(["/blog/retry"]);

    const result = await handleSearchPing({}, context);

    expect(pingIndexNow).toHaveBeenCalledWith(
      expect.arrayContaining(["/blog/retry"]),
    );
    expect(result).toMatchObject({ pinged: true, retried: 1 });
  });

  it("reports the durable retry queue when IndexNow refuses the batch", async () => {
    vi.mocked(dueSearchSubmissions).mockResolvedValue(["/blog/retry"]);
    vi.mocked(pingIndexNow).mockResolvedValue(false);
    vi.mocked(searchSubmissionSummary).mockResolvedValue({
      pending: 1,
      due: 0,
      abandoned: 2,
    });

    const result = await handleSearchPing({}, context);

    expect(result).toMatchObject({
      pinged: false,
      retried: 1,
      queue: { pending: 1, due: 0, abandoned: 2 },
    });
  });

  it("does nothing when the week has no changes and no retries are due", async () => {
    // Tuesday, so the Monday static-page batch is not added.
    vi.setSystemTime(new Date("2026-10-20T06:00:00.000Z"));

    const result = await handleSearchPing({}, context);

    expect(result).toEqual({
      pinged: false,
      count: 0,
      paths: [],
      retried: 0,
    });
    expect(pingIndexNow).not.toHaveBeenCalled();
  });
});
