import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { createTestUser } from "@/test/desktop";

vi.mock("@/lib/server/email/transport", () => ({
  getTransporter: () => ({ sendMail: sendMail }),
}));
const sendMail = vi.fn(async () => ({}));

describe("validBaseUrl (SSRF guard)", () => {
  it.each([
    ["https://integrate.api.nvidia.com/v1", true],
    ["https://api.groq.com/openai/v1", true],
    ["http://api.groq.com/openai/v1", false],
    ["https://localhost:8080/v1", false],
    ["https://127.0.0.1/v1", false],
    ["https://10.0.0.5/v1", false],
    ["https://172.20.1.1/v1", false],
    ["https://192.168.1.10/v1", false],
    ["https://169.254.169.254/latest", false],
    ["https://[::1]/v1", false],
    ["https://[fd00::1]/v1", false],
    ["https://metadata.internal/v1", false],
    ["https://intranet/v1", false],
    ["https://user:pw@api.groq.com/v1", false],
  ])("%s → %s", async (url, ok) => {
    const { validBaseUrl } = await import("@/lib/server/desktop/providers");
    expect(validBaseUrl(url)).toBe(ok);
  });
});

describe("release feed versions", () => {
  it("compares semver-ish versions numerically", async () => {
    const { compareVersions, downloadKey } =
      await import("@/lib/server/desktop/release");
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.7.0", "1.7.0")).toBe(0);
    expect(compareVersions("1.6.9", "1.7.0")).toBe(-1);
    expect(downloadKey("darwin", "arm64")).toBe("macArm64");
    expect(downloadKey("win32", "x64")).toBe("winX64");
    expect(downloadKey("linux", "x64")).toBeNull();
  });
});

describeWithDatabase("desktop production hardening", () => {
  useTestDatabase();
  beforeEach(async () => {
    const c = await import("@/lib/server/db/collections");
    for (const col of [
      c.desktopTokens,
      c.desktopEvents,
      c.desktopPromptLog,
      c.desktopUsageDaily,
      c.desktopAlerts,
      c.desktopProviders,
    ]) {
      await (await col()).deleteMany({});
    }
    sendMail.mockClear();
  });

  async function pair(userId: string) {
    const d = await import("@/lib/server/desktop/devices");
    const p = await d.startPairing({ label: "Notes on macOS" });
    await d.decidePairing({ userCode: p.userCode, userId, approve: true });
    return ((await d.pollPairing(p.deviceCode)) as { token: string }).token;
  }

  it("kills desktop tokens when the account is disabled or its password reset", async () => {
    const { verifyDesktopToken } = await import("@/lib/server/desktop/devices");
    const { adminUsers } = await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");

    const a = await createTestUser();
    const tokenA = await pair(a);
    expect(await verifyDesktopToken(tokenA)).not.toBeNull();
    await (
      await adminUsers()
    ).updateOne({ _id: new ObjectId(a) }, { $set: { status: "disabled" } });
    expect(await verifyDesktopToken(tokenA)).toBeNull();

    const b = await createTestUser();
    const tokenB = await pair(b);
    await (
      await adminUsers()
    ).updateOne({ _id: new ObjectId(b) }, { $inc: { sessionEpoch: 1 } });
    expect(await verifyDesktopToken(tokenB)).toBeNull();
  });

  it("'sign out everywhere' revokes desktop devices too", async () => {
    const { verifyDesktopToken } = await import("@/lib/server/desktop/devices");
    const { revokeAllSessions } = await import("@/lib/server/auth/session");
    const u = await createTestUser();
    const token = await pair(u);
    await revokeAllSessions(u);
    expect(await verifyDesktopToken(token)).toBeNull();
  });

  it("sets the device label from the reported platform, not free text", async () => {
    const { startPairing, findPendingPairing } =
      await import("@/lib/server/desktop/devices");
    const win = await startPairing({
      label: "Your work laptop",
      ctx: { client: "Notes/1.7.0 (win32; x64)" },
    });
    expect((await findPendingPairing(win.userCode))?.label).toBe(
      "Notes on Windows",
    );
    const legacy = await startPairing({ label: "Your work laptop" });
    expect((await findPendingPairing(legacy.userCode))?.label).toBe(
      "Notes desktop app",
    );
  });

  it("does not record events for random tokens (no log flooding)", async () => {
    const { recordRejectedToken } =
      await import("@/lib/server/desktop/devices");
    const { desktopEvents } = await import("@/lib/server/db/collections");
    for (let i = 0; i < 5; i++) await recordRejectedToken(`bcd_random${i}`);
    expect(
      await (await desktopEvents()).countDocuments({ type: "token_rejected" }),
    ).toBe(0);
  });

  it("enforces the per-user daily request cap atomically, and refusals do not count", async () => {
    const q = await import("@/lib/server/desktop/quota");
    await q.setLimits({
      userDailyRequests: 3,
      userDailyTokens: 0,
      globalDailyTokens: 0,
      access: "everyone",
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => q.admitRequest("u1")),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    const { desktopUsageDaily } = await import("@/lib/server/db/collections");
    const doc = await (
      await desktopUsageDaily()
    ).findOne({ _id: `${q.utcDay()}|u1` });
    expect(doc?.requests).toBe(3);
    expect((await q.admitRequest("u2")).allowed).toBe(true); // other users unaffected
  });

  it("enforces token caps per user and globally", async () => {
    const q = await import("@/lib/server/desktop/quota");
    await q.setLimits({
      userDailyRequests: 0,
      userDailyTokens: 1000,
      globalDailyTokens: 1500,
      access: "everyone",
    });
    expect((await q.admitRequest("a")).allowed).toBe(true);
    await q.recordTokens("a", 1000);
    expect(await q.admitRequest("a")).toMatchObject({
      allowed: false,
      reason: "user_tokens",
    });
    expect((await q.admitRequest("b")).allowed).toBe(true);
    await q.recordTokens("b", 600);
    expect(await q.admitRequest("c")).toMatchObject({
      allowed: false,
      reason: "global_tokens",
    });
  });

  it("staff-only access refuses customers", async () => {
    const q = await import("@/lib/server/desktop/quota");
    await q.setLimits({ ...q.DEFAULT_LIMITS, access: "staff" });
    expect(await q.admitRequest("c1", new Date(), "customer")).toMatchObject({
      allowed: false,
      reason: "no_access",
    });
    expect((await q.admitRequest("s1", new Date(), "admin")).allowed).toBe(
      true,
    );
  });

  it("emails one outage alert per window, not one per failure", async () => {
    const { noteDesktopFailure } = await import("@/lib/server/desktop/alerts");
    const now = new Date();
    for (let i = 0; i < 5; i++)
      await noteDesktopFailure("ALL_FAILED", "groq 503", now);
    expect(sendMail).toHaveBeenCalledTimes(1);
    await noteDesktopFailure(
      "ALL_FAILED",
      "groq 503",
      new Date(now.getTime() + 31 * 60 * 1000),
    );
    expect(sendMail).toHaveBeenCalledTimes(2);
    await noteDesktopFailure("CANCELLED", "user stopped", now);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("alerts on a high error rate", async () => {
    const { logDesktopRequest } = await import("@/lib/server/desktop/logs");
    const { noteDesktopFailure } = await import("@/lib/server/desktop/alerts");
    const base = {
      tokenId: null,
      provider: null,
      model: null,
      attempted: [],
      hadImage: false,
      prompt: "p",
      response: "",
      promptTokens: null,
      completionTokens: null,
      latencyMs: 1,
    };
    for (let i = 0; i < 6; i++)
      await logDesktopRequest({
        ...base,
        userId: "x",
        status: "error",
        error: "e",
      });
    for (let i = 0; i < 4; i++)
      await logDesktopRequest({
        ...base,
        userId: "x",
        status: "ok",
        error: null,
      });
    await noteDesktopFailure("STREAM_BROKEN", "cut short");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(
      String(
        (sendMail.mock.calls[0] as unknown as [{ subject: string }])[0].subject,
      ),
    ).toMatch(/60% of desktop requests failed/);
  });

  it("serves the update feed", async () => {
    const { setRelease } = await import("@/lib/server/desktop/release");
    await setRelease({
      latestVersion: "1.8.0",
      minimumVersion: "1.7.0",
      notes: "Faster",
      downloads: {
        macArm64: "https://dl.example.com/a.dmg",
        macX64: "",
        winX64: "http://insecure/x.exe",
        winArm64: "",
      },
    });
    const { GET } = await import("@/app/api/v1/desktop/version/route");
    const res = await (
      await GET(
        new Request(
          "http://x/api/v1/desktop/version?version=1.6.0&platform=darwin&arch=arm64",
        ),
      )
    ).json();
    expect(res).toMatchObject({
      updateAvailable: true,
      updateRequired: true,
      downloadUrl: "https://dl.example.com/a.dmg",
    });
    const win = await (
      await GET(
        new Request(
          "http://x/api/v1/desktop/version?version=1.8.0&platform=win32&arch=x64",
        ),
      )
    ).json();
    expect(win).toMatchObject({
      updateAvailable: false,
      updateRequired: false,
      downloadUrl: null,
    }); // http link dropped
  });
});
