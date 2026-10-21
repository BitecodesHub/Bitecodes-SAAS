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
  }),
}));

vi.mock("@/lib/server/ai-provider", () => ({
  getAiProviderConfig: vi.fn().mockReturnValue(null),
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

  it("respects the run deadline", async () => {
    const slowContext = {
      ...context(),
      deadline: Date.now() - 1000,
    } as unknown as JobContext;

    const result = await handleWeeklyReport({}, slowContext);
    expect(result.skipped).toBe("deadline");
  });
});
