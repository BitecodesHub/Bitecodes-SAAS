import { beforeEach, expect, it, vi } from "vitest";
import type { EmailBlock } from "@/lib/email/template";

vi.mock("@/lib/server/digest/collect", () => ({
  collectDigestSections: vi.fn(),
}));
vi.mock("@/lib/server/email/send", () => ({
  queueEmail: vi.fn(),
}));
vi.mock("@/lib/server/db/collections", () => ({
  jobs: vi.fn(),
  aiAutomationRuns: vi.fn(),
}));
vi.mock("@/lib/server/env", () => ({
  getServerEnv: vi.fn().mockReturnValue({
    CONTACT_NOTIFICATION_TO: ["fallback@example.com"],
  }),
}));
vi.mock("@/lib/server/settings", () => ({
  getSettingsFresh: vi.fn().mockResolvedValue({
    notifications: {
      defaultRecipients: [],
      channels: { ownerReports: { enabled: true, recipients: [] } },
    },
  }),
  recipientsForChannel: () => [],
}));

function context() {
  return {
    jobId: "job-1",
    attempts: 1,
    deadline: Date.now() + 60_000,
    log: vi.fn(),
  };
}

function emailText(blocks: EmailBlock[]): string {
  return blocks
    .map((block) =>
      block.type === "p" || block.type === "h2"
        ? block.text
        : block.type === "ul"
          ? block.items.join("\n")
          : "",
    )
    .join("\n");
}

async function setup() {
  const { collectDigestSections } = await import("@/lib/server/digest/collect");
  const { queueEmail } = await import("@/lib/server/email/send");
  const { jobs, aiAutomationRuns } =
    await import("@/lib/server/db/collections");
  const { getSettingsFresh } = await import("@/lib/server/settings");
  vi.mocked(getSettingsFresh).mockResolvedValue({
    notifications: {
      defaultRecipients: [],
      channels: { ownerReports: { enabled: true, recipients: [] } },
    },
  } as never);
  vi.mocked(queueEmail)
    .mockReset()
    .mockResolvedValue({
      messageId: "m-1",
      status: "queued",
      skipReason: null,
      detail: null,
    } as never);
  vi.mocked(aiAutomationRuns).mockResolvedValue({
    countDocuments: vi.fn().mockResolvedValue(0),
  } as never);
  vi.mocked(jobs).mockResolvedValue({
    find: vi.fn().mockReturnValue({
      project: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as never);
  return { collectDigestSections, queueEmail, jobs, aiAutomationRuns };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("reports a failed section as a gap, not as an empty result", async () => {
  const { collectDigestSections, queueEmail } = await setup();
  vi.mocked(collectDigestSections).mockImplementation(
    async (_range, options) => {
      options?.onError?.("analytics", "timed out after 15000ms");
      return [];
    },
  );

  const { handleDailyDigest } =
    await import("@/lib/server/jobs/handlers/daily-digest");
  const result = await handleDailyDigest({}, context());

  expect(result).toMatchObject({ sections: 0, sectionFailures: 1 });
  const blocks = vi.mocked(queueEmail).mock.calls[0]![0].blocks;
  const text = emailText(blocks);
  expect(text).toContain("Reporting gaps");
  expect(text).toContain("analytics: timed out after 15000ms");
  expect(text).toContain("unknown, not zero");
  expect(text).not.toContain("No section had anything to report");
});

it("marks job and AI statistics unavailable instead of printing zeroes", async () => {
  const { collectDigestSections, queueEmail, jobs, aiAutomationRuns } =
    await setup();
  vi.mocked(collectDigestSections).mockResolvedValue([]);
  vi.mocked(jobs).mockRejectedValue(new Error("database down"));
  vi.mocked(aiAutomationRuns).mockRejectedValue(new Error("database down"));

  const { handleDailyDigest } =
    await import("@/lib/server/jobs/handlers/daily-digest");
  const result = await handleDailyDigest({}, context());

  expect(result).toMatchObject({
    failedJobCount: null,
    deadJobCount: null,
    aiRuns: null,
    aiFailures: null,
  });
  const text = emailText(vi.mocked(queueEmail).mock.calls[0]![0].blocks);
  expect(text).toContain("AI automation calls: unavailable");
  expect(text).toContain("Job failures: unavailable");
  expect(text).not.toContain("Jobs failed in last 24 h: 0");
});

it("counts a gate-refused digest as not sent", async () => {
  const { collectDigestSections, queueEmail } = await setup();
  vi.mocked(collectDigestSections).mockResolvedValue([]);
  vi.mocked(queueEmail).mockResolvedValue({
    messageId: "m-1",
    status: "skipped",
    skipReason: "undeliverable",
    detail: null,
  } as never);

  const { handleDailyDigest } =
    await import("@/lib/server/jobs/handlers/daily-digest");
  const result = await handleDailyDigest({}, context());

  expect(result).toMatchObject({ recipients: 0, refused: 1 });
});

it("states the reporting window with an explicit UTC timezone", async () => {
  const { collectDigestSections, queueEmail } = await setup();
  vi.mocked(collectDigestSections).mockResolvedValue([]);

  const { handleDailyDigest } =
    await import("@/lib/server/jobs/handlers/daily-digest");
  await handleDailyDigest({}, context());

  const text = emailText(vi.mocked(queueEmail).mock.calls[0]![0].blocks);
  expect(text).toMatch(
    /Owner daily digest — \d{4}-\d{2}-\d{2} \d{2}:\d{2} to \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/,
  );
});
