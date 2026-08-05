import { beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Autopilot orchestration against a real MongoDB.
 *
 * The enrolment path is stubbed: what is under test here is the tick's
 * decision-making — the score threshold, the daily cap, the qualified-only
 * filter, and the off switch — not the email engine, which has its own suite.
 */
vi.mock("@/lib/server/email/sequences", () => ({
  enrollProspect: vi.fn(async () => ({ ok: true, enrollmentId: "e1" })),
}));

vi.mock("@/lib/server/jobs/queue", () => ({
  JOB_TYPES: { prospectDiscover: "prospect.discover" },
  enqueueJob: vi.fn(async () => "job1"),
}));

vi.mock("@/lib/server/prospecting/repository", () => ({
  createProspectSearch: vi.fn(async () => {}),
  setProspectStatus: vi.fn(async () => 1),
}));

const settings = {
  automation: {
    autopilot: true,
    autopilotScoreThreshold: 55,
    autopilotDailyEnrollCap: 20,
    globalDailyCap: 150,
  },
};
vi.mock("@/lib/server/settings", () => ({
  getSettingsFresh: vi.fn(async () => settings),
}));

describeWithDatabase("runAutopilotTick", () => {
  useTestDatabase();

  async function seedProspect(overrides: Record<string, unknown>) {
    const { prospects } = await import("@/lib/server/db/collections");
    const now = new Date();
    await (
      await prospects()
    ).insertOne({
      source: "osm",
      sourceId: `node/${Math.round(Math.random() * 1e9)}`,
      dedupeKey: `k${Math.random()}`,
      name: "Test Co",
      email: "owner@test-co.example",
      website: null,
      socialUrl: null,
      lat: 1,
      lng: 1,
      status: "qualified",
      classification: {
        primaryTag: "no-website",
        tags: [],
        score: 80,
        pitchAngles: [],
        topIssues: [],
      },
      signals: null,
      tags: [],
      contactCount: 0,
      enrichedAt: now,
      enrichmentError: null,
      lastContactedAt: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as never);
  }

  beforeEach(async () => {
    const { prospects, sequenceEnrollments } =
      await import("@/lib/server/db/collections");
    await (await prospects()).deleteMany({});
    await (await sequenceEnrollments()).deleteMany({});
    settings.automation.autopilot = true;
    settings.automation.autopilotScoreThreshold = 55;
    settings.automation.autopilotDailyEnrollCap = 20;
    vi.clearAllMocks();
  });

  it("does nothing when autopilot is off", async () => {
    settings.automation.autopilot = false;
    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const summary = await runAutopilotTick();
    expect(summary.enabled).toBe(false);
    expect(summary.enrolled).toBe(0);
  });

  it("enrols qualified, high-score, contactable prospects", async () => {
    await seedProspect({
      classification: {
        primaryTag: "no-website",
        tags: [],
        score: 80,
        pitchAngles: [],
        topIssues: [],
      },
    });
    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const { enrollProspect } = await import("@/lib/server/email/sequences");

    const summary = await runAutopilotTick();
    expect(summary.enrolled).toBe(1);
    expect(enrollProspect).toHaveBeenCalledOnce();
  });

  it("skips prospects below the score threshold", async () => {
    await seedProspect({
      classification: {
        primaryTag: "strong-website",
        tags: [],
        score: 20,
        pitchAngles: [],
        topIssues: [],
      },
    });
    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const summary = await runAutopilotTick();
    expect(summary.candidates).toBe(0);
    expect(summary.enrolled).toBe(0);
  });

  it("skips prospects that are not yet qualified", async () => {
    await seedProspect({ status: "discovered" });
    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const summary = await runAutopilotTick();
    expect(summary.candidates).toBe(0);
  });

  it("skips prospects with no email", async () => {
    await seedProspect({ email: null });
    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const summary = await runAutopilotTick();
    expect(summary.candidates).toBe(0);
  });

  it("respects the daily enrolment cap against existing enrolments", async () => {
    const { sequenceEnrollments } = await import("@/lib/server/db/collections");
    settings.automation.autopilotDailyEnrollCap = 1;
    // One enrolment already made today consumes the whole budget.
    await (
      await sequenceEnrollments()
    ).insertOne({
      enrollmentId: "existing",
      sequenceKey: "outreach.default",
      prospectId: "p0",
      leadId: null,
      email: "prior@test.example",
      status: "active",
      stoppedReason: null,
      currentStep: 1,
      nextRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    await seedProspect({});

    const { runAutopilotTick } = await import("@/lib/server/autopilot");
    const summary = await runAutopilotTick();
    expect(summary.candidates).toBe(0);
    expect(summary.enrolled).toBe(0);
  });
});
