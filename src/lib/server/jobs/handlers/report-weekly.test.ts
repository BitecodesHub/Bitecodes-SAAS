import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleWeeklyReport } from "@/lib/server/jobs/handlers/report-weekly";
import type { JobContext } from "@/lib/server/jobs/worker";
import type { ResolvedSettings } from "@/lib/server/settings";

vi.mock("@/lib/server/settings", () => ({
  getSettingsFresh: vi.fn().mockResolvedValue({
    growth: {
      weeklyReport: true,
      analyticsRollup: true,
    },
    notifications: {
      defaultRecipients: [],
      channels: { ownerReports: { enabled: true, recipients: [] } },
    },
  }),
  recipientsForChannel: (
    settings: {
      notifications: {
        defaultRecipients: string[];
        channels: Record<string, { enabled: boolean; recipients: string[] }>;
      };
    },
    channel: string,
  ) => {
    const prefs = settings.notifications.channels[channel];
    if (!prefs?.enabled) return [];
    return [...prefs.recipients, ...settings.notifications.defaultRecipients];
  },
}));

vi.mock("@/lib/server/ai-provider", () => ({
  getAiProviderConfig: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/server/env", () => ({
  getServerEnv: vi.fn().mockReturnValue({ CONTACT_NOTIFICATION_TO: [] }),
}));

vi.mock("@/lib/server/email/send", () => ({
  queueEmail: vi.fn().mockResolvedValue({ status: "queued" }),
}));

vi.mock("@/lib/server/analytics/repository", () => ({
  getAnalyticsOverview: vi.fn().mockResolvedValue({
    totals: { pageviews: 0, visitors: 0 },
  }),
}));

vi.mock("@/lib/server/leads/repository", () => ({
  countLeadsInRange: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/server/db/collections", () => ({
  prospects: vi.fn().mockResolvedValue({
    countDocuments: vi.fn().mockResolvedValue(0),
  }),
  blogPostDocs: vi.fn().mockResolvedValue({
    countDocuments: vi.fn().mockResolvedValue(0),
  }),
  emailMessages: vi.fn().mockResolvedValue({
    countDocuments: vi.fn().mockResolvedValue(0),
    find: vi.fn().mockReturnValue({
      project: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
}));

function context(): JobContext {
  return {
    jobId: "job_weekly_report_1",
    attempts: 1,
    log: () => {},
    deadline: Date.now() + 60_000,
  };
}

describe("weekly report job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns disabled when weeklyReport toggle is off", async () => {
    const { getSettingsFresh } = await import("@/lib/server/settings");
    vi.mocked(getSettingsFresh).mockResolvedValueOnce({
      growth: {
        weeklyReport: false,
        analyticsRollup: true,
      },
    } as unknown as ResolvedSettings);

    const result = await handleWeeklyReport({}, context());
    expect(result).toEqual({ skipped: "disabled" });
  });

  it("returns disabled when ai provider is not configured", async () => {
    const { getAiProviderConfig } = await import("@/lib/server/ai-provider");
    vi.mocked(getAiProviderConfig).mockReturnValue(null);

    const result = await handleWeeklyReport({}, context());
    expect(result.skipped).toBe(false);
    expect(result.summary).toContain("AI provider not configured");
  });

  it("generates summary when toggle is on and ai is available", async () => {
    const { getAiProviderConfig } = await import("@/lib/server/ai-provider");
    vi.mocked(getAiProviderConfig).mockReturnValue({
      apiKey: "test-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "google/gemini-2.5-flash",
      timeoutMs: 25_000,
      isOpenRouter: true,
    });

    // Mock the fetch for AI key validation
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { limit_remaining: 100 },
        choices: [
          { message: { content: "Weekly performance remained steady." } },
        ],
      }),
    } as unknown as Response);

    const result = await handleWeeklyReport({}, context());
    expect(result.skipped).toBe(false);
    expect(typeof result.summary).toBe("string");
    expect((result.summary as string).length).toBeLessThanOrEqual(300);
    expect(result.metrics).toBeDefined();
    expect(result.period).toBeDefined();
  });

  it("queues the report to owner-report recipients and says which period it covers", async () => {
    const { getSettingsFresh } = await import("@/lib/server/settings");
    vi.mocked(getSettingsFresh).mockResolvedValueOnce({
      growth: { weeklyReport: true, analyticsRollup: true },
      notifications: {
        defaultRecipients: [],
        channels: {
          ownerReports: { enabled: true, recipients: ["owner@example.com"] },
        },
      },
    } as unknown as ResolvedSettings);
    const { queueEmail } = await import("@/lib/server/email/send");

    const result = await handleWeeklyReport({}, context());

    expect(result.emailed).toBe(1);
    expect(result.emailErrors).toEqual([]);
    expect(result.period).toMatchObject({ timezone: "UTC" });
    expect(queueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        category: "internal",
        skipApproval: true,
      }),
    );
  });

  it("does not count a gate-refused message as delivered", async () => {
    const { getSettingsFresh } = await import("@/lib/server/settings");
    vi.mocked(getSettingsFresh).mockResolvedValueOnce({
      growth: { weeklyReport: true, analyticsRollup: true },
      notifications: {
        defaultRecipients: [],
        channels: {
          ownerReports: { enabled: true, recipients: ["owner@example.com"] },
        },
      },
    } as unknown as ResolvedSettings);
    const { queueEmail } = await import("@/lib/server/email/send");
    vi.mocked(queueEmail).mockResolvedValueOnce({
      messageId: "m-1",
      status: "skipped",
      skipReason: "undeliverable",
      detail: null,
    });

    const result = await handleWeeklyReport({}, context());

    expect(result.emailed).toBe(0);
    expect(result.emailErrors).toEqual(["skipped: undeliverable"]);
  });

  it("respects the run deadline", async () => {
    const slowContext = {
      ...context(),
      deadline: Date.now() - 1000,
    } as unknown as JobContext;

    const result = await handleWeeklyReport({}, slowContext);
    expect(result.skipped).toBe("deadline");
  });
});
