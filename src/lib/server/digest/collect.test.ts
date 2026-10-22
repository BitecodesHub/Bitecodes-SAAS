import { describe, expect, it } from "vitest";
import {
  collectDigestSections,
  DIGEST_SECTIONS,
} from "@/lib/server/digest/collect";
import type { DigestSection } from "@/lib/server/digest/types";

const range = {
  from: new Date("2026-10-17T00:00:00.000Z"),
  to: new Date("2026-10-18T00:00:00.000Z"),
};

const section = (id: string): DigestSection => ({
  id,
  title: id,
  summary: `${id} summary`,
  metrics: [],
  blocks: [],
});

describe("collectDigestSections", () => {
  it("keeps declared order, drops nulls, failures, and timeouts", async () => {
    const errors: string[] = [];
    const out = await collectDigestSections(range, {
      timeoutMs: 50,
      onError: (id, message) => errors.push(`${id}: ${message}`),
      sections: [
        {
          id: "slow-first",
          load: async () => async () => {
            await new Promise((r) => setTimeout(r, 20));
            return section("slow-first");
          },
        },
        { id: "empty", load: async () => async () => null },
        {
          id: "broken",
          load: async () => async () => {
            throw new Error("db down");
          },
        },
        {
          id: "hangs",
          load: async () => () => new Promise<never>(() => undefined),
        },
        {
          id: "bad-import",
          load: async () => {
            throw new Error("module missing");
          },
        },
        { id: "last", load: async () => async () => section("last") },
      ],
    });
    expect(out.map((s) => s.id)).toEqual(["slow-first", "last"]);
    // Sections run in parallel, so failures arrive in completion order.
    expect(errors.sort()).toEqual([
      "bad-import: module missing",
      "broken: db down",
      "hangs: timed out after 50ms",
    ]);
  });

  it("passes the range to every section", async () => {
    const seen: unknown[] = [];
    await collectDigestSections(range, {
      sections: [
        {
          id: "a",
          load: async () => async (r) => {
            seen.push(r);
            return null;
          },
        },
      ],
    });
    expect(seen).toEqual([range]);
  });

  it("declares every section file once, each exporting buildSection", async () => {
    const ids = DIGEST_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(
      [
        "analytics",
        "assistant",
        "content",
        "customers-health",
        "customers-lifecycle",
        "leads",
        "proposals",
        "prospects",
        "seo",
      ].sort(),
    );
    for (const entry of DIGEST_SECTIONS) {
      expect(typeof (await entry.load()), entry.id).toBe("function");
    }
  });
});
