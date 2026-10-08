import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("desktop activity tracking", () => {
  useTestDatabase();
  beforeEach(async () => {
    const { desktopTokens, desktopEvents, desktopPromptLog } =
      await import("@/lib/server/db/collections");
    await (await desktopTokens()).deleteMany({});
    await (await desktopEvents()).deleteMany({});
    await (await desktopPromptLog()).deleteMany({});
  });
  const devices = () => import("@/lib/server/desktop/devices");
  const events = () => import("@/lib/server/desktop/events");
  const ctx = { client: "Notes/1.7.0 (darwin; arm64)", ipHash: "iphash123" };

  async function signIn(userId = "user-1") {
    const { startPairing, decidePairing, pollPairing } = await devices();
    const p = await startPairing({ label: "Notes on macOS", ctx });
    await decidePairing({ userCode: p.userCode, userId, approve: true });
    const r = (await pollPairing(p.deviceCode, new Date(), ctx)) as {
      token: string;
      tokenId: string;
    };
    return r;
  }

  it("records the whole device lifecycle, newest first, with build and hashed IP", async () => {
    const { revokeDesktopToken } = await devices();
    const { listDesktopEvents } = await events();
    const { token } = await signIn();
    await revokeDesktopToken(token, ctx);

    const { rows } = await listDesktopEvents();
    expect(rows.map((r) => r.type)).toEqual([
      "signed_out",
      "signed_in",
      "pair_approved",
      "pair_started",
    ]);
    const signedIn = rows.find((r) => r.type === "signed_in")!;
    expect(signedIn).toMatchObject({
      userId: "user-1",
      label: "Notes on macOS",
      client: ctx.client,
      ipHash: ctx.ipHash,
    });
  });

  it("never stores raw tokens or codes in events", async () => {
    const { desktopEvents } = await import("@/lib/server/db/collections");
    const { token } = await signIn();
    const raw = JSON.stringify(
      await (await desktopEvents()).find({}).toArray(),
    );
    expect(raw).not.toContain(token);
  });

  it("records denials, admin disconnects (with the admin) and rejected tokens", async () => {
    const {
      startPairing,
      decidePairing,
      adminRevokeDevice,
      recordRejectedToken,
      verifyDesktopToken,
    } = await devices();
    const { listDesktopEvents } = await events();

    const p = await startPairing({ label: "Notes on Windows" });
    await decidePairing({
      userCode: p.userCode,
      userId: "user-2",
      approve: false,
    });

    const { token, tokenId } = await signIn("user-3");
    expect(await adminRevokeDevice(tokenId, "admin-1")).toBe(true);
    expect(await adminRevokeDevice(tokenId, "admin-1")).toBe(false); // already revoked
    expect(await verifyDesktopToken(token)).toBeNull();
    await recordRejectedToken(token, ctx);
    await recordRejectedToken("not-a-token", ctx); // ignored: not ours

    const types = (await listDesktopEvents()).rows.map((r) => r.type);
    expect(types).toContain("pair_denied");
    expect(types.filter((t) => t === "revoked_by_admin")).toHaveLength(1);
    expect(types.filter((t) => t === "token_rejected")).toHaveLength(1);

    const rejected = (await listDesktopEvents({ type: "token_rejected" }))
      .rows[0];
    expect(rejected).toMatchObject({
      userId: "user-3",
      label: "Notes on macOS",
    });
    const { desktopEvents } = await import("@/lib/server/db/collections");
    const adminEvent = await (
      await desktopEvents()
    ).findOne({ type: "revoked_by_admin" });
    expect(adminEvent?.actorId).toBe("admin-1");
  });

  it("keeps the device's last build on use", async () => {
    const { verifyDesktopToken } = await devices();
    const { listAllDevices } = await events();
    const { token } = await signIn();
    await verifyDesktopToken(token, new Date(), {
      client: "Notes/1.8.0 (win32; x64)",
      ipHash: "x",
    });
    await new Promise((r) => setTimeout(r, 50)); // touch is fire-and-forget
    const [d] = await listAllDevices();
    expect(d.lastClient).toBe("Notes/1.8.0 (win32; x64)");
  });

  it("summarises usage per user, including users with devices but no requests", async () => {
    const { logDesktopRequest } = await import("@/lib/server/desktop/logs");
    const { desktopUsageByUser } = await events();
    await signIn("idle-user");
    const base = {
      tokenId: null,
      provider: "groq" as const,
      model: "m",
      attempted: [],
      prompt: "p",
      response: "r",
      error: null,
      kind: "chat" as const,
    };
    await logDesktopRequest({
      ...base,
      userId: "busy",
      hadImage: true,
      status: "ok",
      promptTokens: 10,
      completionTokens: 5,
      latencyMs: 1000,
    });
    await logDesktopRequest({
      ...base,
      userId: "busy",
      hadImage: false,
      status: "error",
      promptTokens: null,
      completionTokens: null,
      latencyMs: 3000,
    });
    await logDesktopRequest({
      ...base,
      userId: "busy",
      hadImage: false,
      status: "cancelled",
      promptTokens: null,
      completionTokens: null,
      latencyMs: 500,
    });

    const usage = await desktopUsageByUser(30);
    const busy = usage.find((u) => u.userId === "busy")!;
    expect(busy).toMatchObject({
      requests: 3,
      errors: 1,
      screenshots: 1,
      promptTokens: 10,
      completionTokens: 5,
      activeDevices: 0,
    });
    expect(busy.avgLatencyMs).toBe(1500);
    expect(usage.find((u) => u.userId === "idle-user")).toMatchObject({
      requests: 0,
      activeDevices: 1,
    });
  });
});
