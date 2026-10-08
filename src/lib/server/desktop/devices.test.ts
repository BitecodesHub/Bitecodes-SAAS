import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("desktop device pairing", () => {
  useTestDatabase();
  beforeEach(async () => {
    const { desktopTokens } = await import("@/lib/server/db/collections");
    await (await desktopTokens()).deleteMany({});
  });
  const lib = () => import("@/lib/server/desktop/devices");

  it("normalises user codes and rejects ambiguous characters", async () => {
    const { normalizeUserCode } = await lib();
    expect(normalizeUserCode(" abcd efgh ")).toBe("ABCD-EFGH");
    expect(normalizeUserCode("ABCD-EFGH")).toBe("ABCD-EFGH");
    expect(normalizeUserCode("ABCD-EFG0")).toBeNull(); // 0 not in alphabet
    expect(normalizeUserCode("short")).toBeNull();
  });

  it("full flow: start → pending → approve → token issued exactly once → verifies", async () => {
    const {
      startPairing,
      pollPairing,
      findPendingPairing,
      decidePairing,
      verifyDesktopToken,
    } = await lib();
    const p = await startPairing({ label: "Notes on macOS" });
    expect(p.deviceCode.startsWith("dvc_")).toBe(true);
    expect(p.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await pollPairing(p.deviceCode)).toEqual({ status: "pending" });

    const pending = await findPendingPairing(p.userCode.toLowerCase());
    expect(pending?.label).toBe("Notes on macOS");
    expect(
      await decidePairing({
        userCode: p.userCode,
        userId: "user-1",
        approve: true,
      }),
    ).toBe("approved");

    const first = await pollPairing(p.deviceCode);
    expect(first.status).toBe("approved");
    const token = (first as { token: string }).token;
    expect(token.startsWith("bcd_")).toBe(true);
    // Replay cannot mint a second token.
    expect((await pollPairing(p.deviceCode)).status).toBe("expired");

    const device = await verifyDesktopToken(token);
    expect(device?.userId).toBe("user-1");
    expect(await verifyDesktopToken("bcd_wrong")).toBeNull();
  });

  it("stores only hashes", async () => {
    const { startPairing, decidePairing, pollPairing } = await lib();
    const { desktopTokens } = await import("@/lib/server/db/collections");
    const p = await startPairing({});
    await decidePairing({ userCode: p.userCode, userId: "u", approve: true });
    const r = (await pollPairing(p.deviceCode)) as { token: string };
    const raw = JSON.stringify(
      await (await desktopTokens()).find({}).toArray(),
    );
    for (const secret of [p.deviceCode, p.userCode, r.token])
      expect(raw).not.toContain(secret);
  });

  it("a user code can be decided only once, and a denial reaches the app", async () => {
    const { startPairing, decidePairing, pollPairing, findPendingPairing } =
      await lib();
    const p = await startPairing({});
    expect(
      await decidePairing({
        userCode: p.userCode,
        userId: "u",
        approve: false,
      }),
    ).toBe("denied");
    expect(
      await decidePairing({
        userCode: p.userCode,
        userId: "attacker",
        approve: true,
      }),
    ).toBe("not-found");
    expect(await findPendingPairing(p.userCode)).toBeNull();
    expect(await pollPairing(p.deviceCode)).toEqual({ status: "denied" });
  });

  it("expired pairings cannot be approved or redeemed", async () => {
    const { startPairing, decidePairing, pollPairing } = await lib();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const p = await startPairing({ now: past });
    expect(
      await decidePairing({ userCode: p.userCode, userId: "u", approve: true }),
    ).toBe("not-found");
    expect(await pollPairing(p.deviceCode)).toEqual({ status: "expired" });
  });

  it("lists and revokes a user's devices, scoped to that user", async () => {
    const {
      startPairing,
      decidePairing,
      pollPairing,
      listDevices,
      revokeDevice,
      verifyDesktopToken,
      revokeDesktopToken,
    } = await lib();
    const pair = async (userId: string) => {
      const p = await startPairing({ label: userId });
      await decidePairing({ userCode: p.userCode, userId, approve: true });
      return (await pollPairing(p.deviceCode)) as {
        token: string;
        tokenId: string;
      };
    };
    const mine = await pair("alice");
    const theirs = await pair("bob");
    expect((await listDevices("alice")).map((d) => d.id)).toEqual([
      mine.tokenId,
    ]);
    expect(await revokeDevice("alice", theirs.tokenId)).toBe(false); // not alice's
    expect(await revokeDevice("alice", mine.tokenId)).toBe(true);
    expect(await verifyDesktopToken(mine.token)).toBeNull();
    expect(await revokeDesktopToken(theirs.token)).toBe(true);
    expect(await verifyDesktopToken(theirs.token)).toBeNull();
  });
});
