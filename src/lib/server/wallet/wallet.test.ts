import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Wallet tests against a real MongoDB.
 *
 * Two properties matter most and are therefore tested directly rather than
 * mocked: product isolation (chatbot credits must never fund a forms debit) and
 * the atomic-spend guarantee under genuine concurrency.
 */
describeWithDatabase("credit wallet", () => {
  useTestDatabase();

  const OWNER = "owner-w";

  beforeEach(async () => {
    const { walletBalances, walletLedger } =
      await import("@/lib/server/db/collections");
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
  });

  it("starts every product at zero", async () => {
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    expect(await getBalance(OWNER, "forms")).toBe(0);
    expect(await getBalance(OWNER, "chatbot")).toBe(0);
  });

  it("keeps products in separate pools", async () => {
    const { credit, debit, getBalance } =
      await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "chatbot",
      amount: 1000,
      kind: "purchase",
    });

    // Chatbot tokens must not fund a forms submission.
    const attempt = await debit({
      ownerId: OWNER,
      product: "forms",
      amount: 1,
    });
    expect(attempt.ok).toBe(false);
    expect(await getBalance(OWNER, "chatbot")).toBe(1000);
    expect(await getBalance(OWNER, "forms")).toBe(0);

    // Crediting forms leaves the chatbot pool untouched.
    await credit({
      ownerId: OWNER,
      product: "forms",
      amount: 50,
      kind: "purchase",
    });
    expect(await getBalance(OWNER, "forms")).toBe(50);
    expect(await getBalance(OWNER, "chatbot")).toBe(1000);
  });

  it("records a signed journal row carrying the product and refId", async () => {
    const { credit, debit, recentLedger } =
      await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "forms",
      amount: 10,
      kind: "purchase",
    });
    const result = await debit({
      ownerId: OWNER,
      product: "forms",
      amount: 1,
      subjectId: "form-1",
      refId: "sub-1",
    });
    expect(result).toEqual({ ok: true, balanceAfter: 9 });

    const rows = await recentLedger(OWNER, "forms", 10);
    const debitRow = rows.find((r) => r.kind === "deduct");
    expect(debitRow?.delta).toBe(-1);
    expect(debitRow?.product).toBe("forms");
    expect(debitRow?.subjectId).toBe("form-1");
    expect(debitRow?.refId).toBe("sub-1");
    // The journal for one product must not include the other's rows.
    expect(rows.every((r) => r.product === "forms")).toBe(true);
  });

  it("refuses to overspend and leaves the balance untouched", async () => {
    const { credit, debit, getBalance } =
      await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "forms",
      amount: 3,
      kind: "purchase",
    });
    const result = await debit({ ownerId: OWNER, product: "forms", amount: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficient");
    expect(await getBalance(OWNER, "forms")).toBe(3);
  });

  it("rejects a non-positive amount", async () => {
    const { debit } = await import("@/lib/server/wallet/wallet");
    const result = await debit({ ownerId: OWNER, product: "forms", amount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid-amount");
  });

  it("drains a short balance to zero instead of refusing delivered work", async () => {
    const { credit, debitUpTo, getBalance } =
      await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "chatbot",
      amount: 60,
      kind: "purchase",
    });

    const result = await debitUpTo({
      ownerId: OWNER,
      product: "chatbot",
      amount: 150,
      refId: "turn-1",
    });
    expect(result).toEqual({ charged: 60, shortfall: 90, balanceAfter: 0 });
    expect(await getBalance(OWNER, "chatbot")).toBe(0);

    // The ledger records only what was actually taken.
    const { recentLedger } = await import("@/lib/server/wallet/wallet");
    const rows = await recentLedger(OWNER, "chatbot", 5);
    const deductRow = rows.find((r) => r.kind === "deduct");
    expect(deductRow?.delta).toBe(-60);
    expect(deductRow?.refId).toBe("turn-1");
  });

  it("charges in full when the balance covers it", async () => {
    const { credit, debitUpTo } = await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "chatbot",
      amount: 500,
      kind: "purchase",
    });
    const result = await debitUpTo({
      ownerId: OWNER,
      product: "chatbot",
      amount: 150,
    });
    expect(result).toEqual({ charged: 150, shortfall: 0, balanceAfter: 350 });
  });

  it("takes nothing from a wallet that was never credited", async () => {
    const { debitUpTo } = await import("@/lib/server/wallet/wallet");
    const result = await debitUpTo({
      ownerId: "never-credited",
      product: "chatbot",
      amount: 150,
    });
    expect(result).toEqual({
      charged: 0,
      shortfall: 150,
      balanceAfter: 0,
    });
  });

  it("never lets concurrent drains overshoot the balance", async () => {
    const { credit, debitUpTo, getBalance } =
      await import("@/lib/server/wallet/wallet");
    // 60 credits, twenty concurrent drains of 60: exactly 60 may be taken.
    await credit({
      ownerId: OWNER,
      product: "chatbot",
      amount: 60,
      kind: "purchase",
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        debitUpTo({ ownerId: OWNER, product: "chatbot", amount: 60 }),
      ),
    );

    const charged = results.reduce((sum, r) => sum + r.charged, 0);
    expect(charged).toBe(60);
    expect(await getBalance(OWNER, "chatbot")).toBe(0);
  });

  it("never lets concurrent debits overspend", async () => {
    const { credit, debit, getBalance } =
      await import("@/lib/server/wallet/wallet");
    // 10 credits, twenty concurrent single-credit debits: exactly 10 may win.
    await credit({
      ownerId: OWNER,
      product: "forms",
      amount: 10,
      kind: "purchase",
    });

    const attempts = await Promise.all(
      Array.from({ length: 20 }, () =>
        debit({ ownerId: OWNER, product: "forms", amount: 1 }),
      ),
    );

    expect(attempts.filter((a) => a.ok).length).toBe(10);
    expect(await getBalance(OWNER, "forms")).toBe(0);
  });
});
