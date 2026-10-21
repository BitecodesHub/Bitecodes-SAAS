import { describe, expect, it, vi } from "vitest";
import { GROWTH_TOGGLE_KEYS } from "@/lib/growth/toggles";
import {
  dueAutomations,
  enqueueDueAutomations,
  RECURRING_AUTOMATIONS,
  utcDayOfYear,
  type RecurringAutomation,
} from "@/lib/server/jobs/schedule";

const at = (iso: string) => new Date(iso);
const keysAt = (iso: string) =>
  dueAutomations(at(iso)).map((d) => d.idempotencyKey);
const typesAt = (iso: string) => dueAutomations(at(iso)).map((d) => d.type);

function entry(
  cadence: RecurringAutomation["cadence"],
  id = "x",
): RecurringAutomation {
  return {
    id,
    type: "digest.daily",
    label: "x",
    description: "x",
    cadence,
    toggle: null,
    sendsExternalEmail: false,
    owner: "test",
  };
}
const due = (cadence: RecurringAutomation["cadence"], iso: string) =>
  dueAutomations(at(iso), [entry(cadence)]);

describe("registry", () => {
  it("has unique ids and valid cadences, toggles, and copy", () => {
    const ids = RECURRING_AUTOMATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of RECURRING_AUTOMATIONS) {
      expect(a.label.length, a.id).toBeGreaterThan(0);
      expect(a.description.length, a.id).toBeGreaterThan(20);
      expect(a.owner.length, a.id).toBeGreaterThan(0);
      if (a.toggle) expect(GROWTH_TOGGLE_KEYS, a.id).toContain(a.toggle);
      const c = a.cadence;
      if (c.kind === "daily" || c.kind === "weekly" || c.kind === "monthly") {
        expect(c.hourUtc, a.id).toBeGreaterThanOrEqual(0);
        expect(c.hourUtc, a.id).toBeLessThanOrEqual(23);
      }
      if (c.kind === "weekly") {
        expect(c.weekdaysUtc.length, a.id).toBeGreaterThan(0);
        for (const d of c.weekdaysUtc)
          expect([0, 1, 2, 3, 4, 5, 6]).toContain(d);
      }
      if (c.kind === "monthly") {
        expect(c.dayOfMonth, a.id).toBeGreaterThanOrEqual(1);
        expect(c.dayOfMonth, a.id).toBeLessThanOrEqual(31);
      }
    }
  });

  it("schedules each job type once", () => {
    const types = RECURRING_AUTOMATIONS.map((a) => a.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("matches the contract cadence table", () => {
    const cadence = Object.fromEntries(
      RECURRING_AUTOMATIONS.map((a) => [a.type, a.cadence]),
    );
    expect(cadence).toEqual({
      "sequence.tick": { kind: "minute" },
      "autopilot.tick": { kind: "quarter-hour" },
      "reply.poll": { kind: "quarter-hour" },
      "blog.publish-scheduled": { kind: "quarter-hour" },
      "analytics.rollup": { kind: "daily", hourUtc: 1 },
      "chat.summaries": { kind: "daily", hourUtc: 1 },
      "churn.scan": { kind: "daily", hourUtc: 2 },
      "lead.score": { kind: "daily", hourUtc: 2 },
      "prospect.research": { kind: "daily", hourUtc: 3 },
      "outreach.draft": { kind: "daily", hourUtc: 3 },
      "digest.daily": { kind: "daily", hourUtc: 4 },
      "lifecycle.tick": { kind: "daily", hourUtc: 5 },
      "search.ping": { kind: "daily", hourUtc: 6 },
      "proposal.followups": { kind: "daily", hourUtc: 6 },
      "booking.reminders": { kind: "quarter-hour" },
      "report.weekly": { kind: "weekly", weekdaysUtc: [1], hourUtc: 3 },
      "social.drafts": { kind: "weekly", weekdaysUtc: [1], hourUtc: 4 },
      "feedback.requests": { kind: "weekly", weekdaysUtc: [3], hourUtc: 5 },
      "newsletter.draft": { kind: "weekly", weekdaysUtc: [4], hourUtc: 4 },
      "blog.generate": { kind: "weekly", weekdaysUtc: [2, 5], hourUtc: 5 },
      "seo.selfaudit": { kind: "weekly", weekdaysUtc: [0], hourUtc: 2 },
      "report.monthly": { kind: "monthly", dayOfMonth: 1, hourUtc: 4 },
    });
  });

  it("keeps automations that email others behind a toggle, except the core email engine", () => {
    for (const a of RECURRING_AUTOMATIONS) {
      if (a.sendsExternalEmail && a.toggle === null) {
        // Sequences and autopilot are gated by settings.automation and the
        // approval queue instead.
        expect(["sequence-tick", "autopilot-tick"]).toContain(a.id);
      }
    }
  });
});

describe("minute cadence", () => {
  it("keys to the minute bucket", () => {
    const t = at("2026-10-18T10:07:00.000Z").getTime();
    expect(due({ kind: "minute" }, "2026-10-18T10:07:00.000Z")).toEqual([
      {
        type: "digest.daily",
        idempotencyKey: `x:${Math.floor(t / 60_000)}`,
        payload: {},
      },
    ]);
  });

  it("is stable within a minute and changes at the boundary", () => {
    const a = due({ kind: "minute" }, "2026-10-18T10:07:00.000Z")[0];
    const b = due({ kind: "minute" }, "2026-10-18T10:07:59.999Z")[0];
    const c = due({ kind: "minute" }, "2026-10-18T10:08:00.000Z")[0];
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(c.idempotencyKey).not.toBe(a.idempotencyKey);
  });
});

describe("quarter-hour cadence", () => {
  it("is stable within 15 minutes and changes at the boundary", () => {
    const k = (iso: string) =>
      due({ kind: "quarter-hour" }, iso)[0].idempotencyKey;
    expect(k("2026-10-18T10:00:00.000Z")).toBe(k("2026-10-18T10:14:59.999Z"));
    expect(k("2026-10-18T10:15:00.000Z")).not.toBe(
      k("2026-10-18T10:14:59.999Z"),
    );
    const t = at("2026-10-18T10:15:00.000Z").getTime();
    expect(k("2026-10-18T10:15:00.000Z")).toBe(`x:${t / 900_000}`);
  });
});

describe("daily cadence", () => {
  const daily = { kind: "daily", hourUtc: 4 } as const;

  it("is not due before the hour", () => {
    expect(due(daily, "2026-10-18T00:00:00.000Z")).toEqual([]);
    expect(due(daily, "2026-10-18T03:59:59.999Z")).toEqual([]);
  });

  it("is due from the hour to the end of the UTC day, keyed per date", () => {
    for (const iso of [
      "2026-10-18T04:00:00.000Z",
      "2026-10-18T12:30:00.000Z",
      "2026-10-18T23:59:59.999Z",
    ]) {
      expect(due(daily, iso)).toEqual([
        {
          type: "digest.daily",
          idempotencyKey: "x:2026-10-18",
          payload: { date: "2026-10-18" },
        },
      ]);
    }
  });

  it("starts a new key on the next UTC date", () => {
    expect(due(daily, "2026-10-19T03:00:00.000Z")).toEqual([]);
    expect(due(daily, "2026-10-19T04:00:00.000Z")[0].idempotencyKey).toBe(
      "x:2026-10-19",
    );
  });

  it("handles hour 0 as due all day", () => {
    expect(
      due({ kind: "daily", hourUtc: 0 }, "2026-10-18T00:00:00.000Z"),
    ).toHaveLength(1);
  });

  it("produces exactly one key per day across a day of 5-minute cron runs", () => {
    const keys = new Set<string>();
    const start = at("2026-10-18T00:00:00.000Z").getTime();
    for (let t = start; t < start + 86_400_000; t += 300_000) {
      for (const d of dueAutomations(new Date(t), [entry(daily)])) {
        keys.add(d.idempotencyKey);
      }
    }
    expect([...keys]).toEqual(["x:2026-10-18"]);
  });
});

describe("weekly cadence", () => {
  const blog = { kind: "weekly", weekdaysUtc: [2, 5], hourUtc: 5 } as const;

  it("is due only on listed weekdays after the hour", () => {
    // 2026-10-20 is a Tuesday, 2026-10-23 a Friday.
    expect(due(blog, "2026-10-20T04:59:59.999Z")).toEqual([]);
    expect(due(blog, "2026-10-20T05:00:00.000Z")[0].idempotencyKey).toBe(
      "x:2026-10-20",
    );
    expect(due(blog, "2026-10-21T05:00:00.000Z")).toEqual([]); // Wednesday
    expect(due(blog, "2026-10-23T23:59:00.000Z")[0].idempotencyKey).toBe(
      "x:2026-10-23",
    );
    expect(due(blog, "2026-10-24T05:00:00.000Z")).toEqual([]); // Saturday
  });

  it("treats Sunday as weekday 0", () => {
    const sunday = { kind: "weekly", weekdaysUtc: [0], hourUtc: 2 } as const;
    expect(due(sunday, "2026-10-18T02:00:00.000Z")).toHaveLength(1); // Sunday
    expect(due(sunday, "2026-10-19T02:00:00.000Z")).toEqual([]); // Monday
  });

  it("uses the UTC weekday, not a local one", () => {
    // Monday 23:30 UTC is already Tuesday in India; it is still Monday here.
    const monday = { kind: "weekly", weekdaysUtc: [1], hourUtc: 3 } as const;
    expect(due(monday, "2026-10-19T23:30:00.000Z")).toHaveLength(1);
    expect(due(monday, "2026-10-20T03:30:00.000Z")).toEqual([]);
  });
});

describe("monthly cadence", () => {
  const monthly = { kind: "monthly", dayOfMonth: 1, hourUtc: 4 } as const;

  it("is not due on the first before the hour", () => {
    expect(due(monthly, "2026-11-01T03:59:59.999Z")).toEqual([]);
  });

  it("is due from the hour on the first, keyed per month", () => {
    expect(due(monthly, "2026-11-01T04:00:00.000Z")).toEqual([
      {
        type: "digest.daily",
        idempotencyKey: "x:2026-11",
        payload: { period: "2026-11" },
      },
    ]);
  });

  it("catches up on later days of the month with the same key", () => {
    // A missed 1st still runs on the 2nd, at any hour, under the same key.
    expect(due(monthly, "2026-11-02T00:05:00.000Z")[0].idempotencyKey).toBe(
      "x:2026-11",
    );
    expect(due(monthly, "2026-11-30T23:59:00.000Z")[0].idempotencyKey).toBe(
      "x:2026-11",
    );
  });

  it("is not due before the start day", () => {
    const mid = { kind: "monthly", dayOfMonth: 15, hourUtc: 4 } as const;
    expect(due(mid, "2026-11-14T23:00:00.000Z")).toEqual([]);
    expect(due(mid, "2026-11-15T03:00:00.000Z")).toEqual([]);
    expect(due(mid, "2026-11-15T04:00:00.000Z")).toHaveLength(1);
  });

  it("clamps a start day past the end of a short month", () => {
    const late = { kind: "monthly", dayOfMonth: 31, hourUtc: 4 } as const;
    expect(due(late, "2027-02-28T03:00:00.000Z")).toEqual([]);
    expect(due(late, "2027-02-28T04:00:00.000Z")[0].idempotencyKey).toBe(
      "x:2027-02",
    );
    expect(due(late, "2028-02-28T04:00:00.000Z")).toEqual([]); // leap year
    expect(due(late, "2028-02-29T04:00:00.000Z")).toHaveLength(1);
  });

  it("crosses the year boundary into a new key", () => {
    expect(due(monthly, "2026-12-31T23:59:00.000Z")[0].idempotencyKey).toBe(
      "x:2026-12",
    );
    expect(due(monthly, "2027-01-01T03:00:00.000Z")).toEqual([]);
    expect(due(monthly, "2027-01-01T04:00:00.000Z")[0].idempotencyKey).toBe(
      "x:2027-01",
    );
  });
});

describe("dueAutomations with the real registry", () => {
  it("keeps the legacy idempotency keys of the pre-existing ticks", () => {
    const now = at("2026-10-20T05:07:00.000Z"); // Tuesday
    const minute = Math.floor(now.getTime() / 60_000);
    const quarter = Math.floor(now.getTime() / 900_000);
    const keys = keysAt(now.toISOString());
    expect(keys).toContain(`sequence-tick:${minute}`);
    expect(keys).toContain(`autopilot-tick:${quarter}`);
    expect(keys).toContain(`reply-poll:${quarter}`);
    expect(keys).toContain(`blog-publish:${quarter}`);
    expect(keys).toContain("daily-digest:2026-10-20");
    expect(keys).toContain("blog-generate:2026-10-20");
  });

  it("keeps the blog.generate payload as { dayOfYear }", () => {
    const blog = dueAutomations(at("2026-10-20T05:00:00.000Z")).find(
      (d) => d.type === "blog.generate",
    );
    expect(blog?.payload).toEqual({ dayOfYear: 293 });
  });

  it("runs only the sub-daily ticks and the monthly catch-up just after midnight UTC", () => {
    expect(typesAt("2026-10-18T00:10:00.000Z").sort()).toEqual(
      [
        "autopilot.tick",
        "blog.publish-scheduled",
        "booking.reminders",
        "reply.poll",
        "sequence.tick",
        // Later in the month: the month's (idempotent) key is still due.
        "report.monthly",
      ].sort(),
    );
    expect(typesAt("2026-11-01T00:10:00.000Z")).not.toContain("report.monthly");
  });

  it("adds daily jobs hour by hour", () => {
    const at0300 = typesAt("2026-10-21T03:00:00.000Z"); // Wednesday
    expect(at0300).toEqual(
      expect.arrayContaining([
        "analytics.rollup",
        "chat.summaries",
        "churn.scan",
        "lead.score",
        "prospect.research",
        "outreach.draft",
      ]),
    );
    expect(at0300).not.toContain("digest.daily");
    expect(at0300).not.toContain("feedback.requests"); // Wednesday, but 05:00
    const at0600 = typesAt("2026-10-21T06:00:00.000Z");
    expect(at0600).toEqual(
      expect.arrayContaining([
        "digest.daily",
        "lifecycle.tick",
        "search.ping",
        "proposal.followups",
        "feedback.requests",
      ]),
    );
    expect(at0600).not.toContain("report.weekly"); // Monday only
    expect(at0600).not.toContain("blog.generate"); // Tuesday and Friday
  });

  it("schedules the Monday, Thursday, and Sunday jobs on their days", () => {
    expect(typesAt("2026-10-19T04:00:00.000Z")).toEqual(
      expect.arrayContaining(["report.weekly", "social.drafts"]),
    );
    expect(typesAt("2026-10-22T04:00:00.000Z")).toContain("newsletter.draft");
    expect(typesAt("2026-10-18T02:00:00.000Z")).toContain("seo.selfaudit");
    expect(typesAt("2026-10-18T01:59:00.000Z")).not.toContain("seo.selfaudit");
  });

  it("schedules the monthly report on the 1st from 04:00", () => {
    expect(typesAt("2026-11-01T03:55:00.000Z")).not.toContain("report.monthly");
    const monthly = dueAutomations(at("2026-11-01T04:00:00.000Z")).find(
      (d) => d.type === "report.monthly",
    );
    expect(monthly).toEqual({
      type: "report.monthly",
      idempotencyKey: "report-monthly:2026-11",
      payload: { period: "2026-11" },
    });
  });

  it("returns unique idempotency keys", () => {
    const keys = keysAt("2026-11-02T06:00:00.000Z");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("utcDayOfYear", () => {
  it("counts from 1 on 1 January and handles leap years", () => {
    expect(utcDayOfYear(at("2026-01-01T00:00:00.000Z"))).toBe(1);
    expect(utcDayOfYear(at("2026-12-31T23:59:59.000Z"))).toBe(365);
    expect(utcDayOfYear(at("2028-12-31T12:00:00.000Z"))).toBe(366);
  });
});

describe("enqueueDueAutomations", () => {
  it("enqueues every due automation and survives a failing item", async () => {
    const now = at("2026-10-20T05:07:00.000Z");
    const expected = dueAutomations(now);
    const enqueue = vi.fn(async (opts: { type: string }) => {
      if (opts.type === "reply.poll") throw new Error("db hiccup");
      return "id";
    });
    const result = await enqueueDueAutomations(
      now,
      enqueue as unknown as Parameters<typeof enqueueDueAutomations>[1],
    );
    expect(enqueue).toHaveBeenCalledTimes(expected.length);
    expect(result.failed).toEqual(["reply.poll"]);
    expect(result.enqueued).toBe(expected.length - 1);
    expect(enqueue).toHaveBeenCalledWith({
      type: "blog.generate",
      payload: { dayOfYear: 293 },
      idempotencyKey: "blog-generate:2026-10-20",
    });
  });
});
