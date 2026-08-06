import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Token ledger tests against a real MongoDB. The atomic-deduction guarantee is
 * the whole point, so it is tested under genuine concurrency rather than
 * mocked — a fake would just reimplement the property being verified.
 */
describeWithDatabase("token ledger", () => {
  useTestDatabase();

  const OWNER = "owner-1";

  beforeEach(async () => {
    const { chatbotBalances, chatbotTokenLedger } =
      await import("@/lib/server/db/collections");
    await (await chatbotBalances()).deleteMany({});
    await (await chatbotTokenLedger()).deleteMany({});
  });

  it("starts at zero", async () => {
    const { getBalance } = await import("@/lib/server/tokens-ledger/ledger");
    expect(await getBalance(OWNER)).toBe(0);
  });

  it("credits and reflects the new balance", async () => {
    const { credit, getBalance } =
      await import("@/lib/server/tokens-ledger/ledger");
    expect(
      await credit({ ownerId: OWNER, amount: 1000, kind: "purchase" }),
    ).toBe(1000);
    expect(await credit({ ownerId: OWNER, amount: 500, kind: "bonus" })).toBe(
      1500,
    );
    expect(await getBalance(OWNER)).toBe(1500);
  });

  it("deducts and records a signed ledger row", async () => {
    const { credit, deduct, recentLedger } =
      await import("@/lib/server/tokens-ledger/ledger");
    await credit({ ownerId: OWNER, amount: 1000, kind: "purchase" });
    const result = await deduct({
      ownerId: OWNER,
      amount: 300,
      messageId: "m1",
    });
    expect(result).toEqual({ ok: true, balanceAfter: 700 });

    const rows = await recentLedger(OWNER, 10);
    const deductRow = rows.find((r) => r.kind === "deduct");
    expect(deductRow?.delta).toBe(-300);
    expect(deductRow?.balanceAfter).toBe(700);
    expect(deductRow?.messageId).toBe("m1");
  });

  it("refuses to overspend", async () => {
    const { credit, deduct, getBalance } =
      await import("@/lib/server/tokens-ledger/ledger");
    await credit({ ownerId: OWNER, amount: 100, kind: "purchase" });
    const result = await deduct({ ownerId: OWNER, amount: 250 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficient");
    // Balance is untouched by a refused deduction.
    expect(await getBalance(OWNER)).toBe(100);
  });

  it("rejects a non-positive amount", async () => {
    const { deduct } = await import("@/lib/server/tokens-ledger/ledger");
    const result = await deduct({ ownerId: OWNER, amount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid-amount");
  });

  it("never lets concurrent deductions overspend", async () => {
    const { credit, deduct, getBalance } =
      await import("@/lib/server/tokens-ledger/ledger");
    // 10 units, twenty concurrent deductions of 1: exactly 10 may win.
    await credit({ ownerId: OWNER, amount: 10, kind: "purchase" });

    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => deduct({ ownerId: OWNER, amount: 1 })),
    );
    const succeeded = attempts.filter((a) => a.ok).length;

    expect(succeeded).toBe(10);
    expect(await getBalance(OWNER)).toBe(0);
  });
});
