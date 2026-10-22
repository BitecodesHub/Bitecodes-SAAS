import { afterEach, beforeEach, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Billing webhook tests against a real MongoDB.
 *
 * The property that matters is that a retried delivery credits exactly once —
 * gateways retry by design, so this is the difference between correct billing
 * and silently giving away packs. Tested through the real Razorpay verifier with
 * a locally signed body, so signature handling is exercised too.
 */
describeWithDatabase("billing webhook", () => {
  useTestDatabase();

  const OWNER = "owner-b";
  const SECRET = "test_webhook_secret";

  beforeEach(async () => {
    const { billingEvents, billingOrders, walletBalances, walletLedger } =
      await import("@/lib/server/db/collections");
    await (await billingEvents()).deleteMany({});
    await (await billingOrders()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});

    // Configure Razorpay so its verifier is active for these tests.
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  /** Inserts a pending order the way `createOrder` would. */
  async function seedOrder(credits = 500) {
    const { billingOrders } = await import("@/lib/server/db/collections");
    const orderId = "ord_test_0001";
    const now = new Date();
    await (
      await billingOrders()
    ).insertOne({
      orderId,
      ownerId: OWNER,
      product: "forms",
      packId: "forms-starter",
      credits,
      amount: 49_900,
      currency: "INR",
      gateway: "razorpay",
      gatewayOrderId: null,
      status: "pending",
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    } as never);
    return orderId;
  }

  function signedDelivery(
    orderId: string,
    paymentId = "pay_test_1",
    overrides: { amount?: number; currency?: string } = {},
  ) {
    const entity: Record<string, unknown> = {
      id: paymentId,
      notes: { orderId },
      ...(overrides.amount !== undefined ? { amount: overrides.amount } : {}),
      ...(overrides.currency !== undefined
        ? { currency: overrides.currency }
        : {}),
    };
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity } },
    });
    const signature = createHmac("sha256", SECRET).update(body).digest("hex");
    return {
      body,
      headers: new Headers({ "x-razorpay-signature": signature }),
    };
  }

  it("credits the wallet once for a verified payment", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);
    const { body, headers } = signedDelivery(orderId);

    const outcome = await processWebhook(body, headers);
    expect(outcome.kind).toBe("credited");
    if (outcome.kind === "credited") expect(outcome.credits).toBe(500);
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("credits exactly once when the same event is delivered twice", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);
    const delivery = signedDelivery(orderId);

    const first = await processWebhook(delivery.body, delivery.headers);
    const second = await processWebhook(delivery.body, delivery.headers);

    expect(first.kind).toBe("credited");
    expect(second.kind).toBe("duplicate");
    // The decisive assertion: one pack, not two.
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("credits once even when two deliveries race", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);
    const delivery = signedDelivery(orderId);

    const outcomes = await Promise.all([
      processWebhook(delivery.body, delivery.headers),
      processWebhook(delivery.body, delivery.headers),
      processWebhook(delivery.body, delivery.headers),
    ]);

    expect(outcomes.filter((o) => o.kind === "credited")).toHaveLength(1);
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("rejects a body whose signature does not match", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder();

    const { body } = signedDelivery(orderId);
    const outcome = await processWebhook(
      body,
      new Headers({ "x-razorpay-signature": "deadbeef" }),
    );

    expect(outcome.kind).toBe("unverified");
    expect(await getBalance(OWNER, "forms")).toBe(0);
  });

  it("rejects a tampered body signed for different content", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder();
    const { headers } = signedDelivery(orderId);

    // Same signature, body swapped for a bigger pack's order.
    const tampered = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: "pay_x", notes: { orderId: "ord_other" } } },
      },
    });

    expect((await processWebhook(tampered, headers)).kind).toBe("unverified");
    expect(await getBalance(OWNER, "forms")).toBe(0);
  });

  it("ignores a non-payment event without crediting", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder();

    const body = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay_failed", notes: { orderId } } },
      },
    });
    const headers = new Headers({
      "x-razorpay-signature": createHmac("sha256", SECRET)
        .update(body)
        .digest("hex"),
    });

    const outcome = await processWebhook(body, headers);
    expect(outcome.kind).toBe("ignored");
    expect(await getBalance(OWNER, "forms")).toBe(0);
  });

  it("ignores a verified event for an order we do not know", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { body, headers } = signedDelivery("ord_does_not_exist");

    expect((await processWebhook(body, headers)).kind).toBe("ignored");
    expect(await getBalance(OWNER, "forms")).toBe(0);
  });

  it("marks the order paid so a later delivery cannot re-settle it", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getOrder } = await import("@/lib/server/billing/orders");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);

    const first = signedDelivery(orderId);
    await processWebhook(first.body, first.headers);
    expect((await getOrder(orderId))?.status).toBe("paid");

    // A different payment id for the same order: new event, already-paid order.
    const late = signedDelivery(orderId, "pay_test_2");
    expect((await processWebhook(late.body, late.headers)).kind).toBe(
      "duplicate",
    );
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("credits an unknown-order payment once the order appears", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");

    // The delivery races the order row (checkout and webhook land close
    // together). The first delivery must not burn the event's idempotency
    // slot, or the payment could never be credited.
    const delivery = signedDelivery("ord_test_0001");
    expect((await processWebhook(delivery.body, delivery.headers)).kind).toBe(
      "ignored",
    );

    await seedOrder(500);
    expect((await processWebhook(delivery.body, delivery.headers)).kind).toBe(
      "credited",
    );
    expect(await getBalance(OWNER, "forms")).toBe(500);

    // And still exactly once after that.
    expect((await processWebhook(delivery.body, delivery.headers)).kind).toBe(
      "duplicate",
    );
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("refuses a payment whose amount does not match the order", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getOrder } = await import("@/lib/server/billing/orders");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);

    // 1 rupee for a ₹499 pack, signature and all: provenance is not price.
    const short = signedDelivery(orderId, "pay_short", { amount: 100 });
    const outcome = await processWebhook(short.body, short.headers);
    expect(outcome.kind).toBe("ignored");
    expect(await getBalance(OWNER, "forms")).toBe(0);
    expect((await getOrder(orderId))?.status).toBe("pending");

    // The mismatch did not consume the event: the honest amount settles.
    const honest = signedDelivery(orderId, "pay_short", { amount: 49_900 });
    expect((await processWebhook(honest.body, honest.headers)).kind).toBe(
      "credited",
    );
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("refuses a payment in the wrong currency", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);

    const dollar = signedDelivery(orderId, "pay_usd", {
      amount: 49_900,
      currency: "USD",
    });
    expect((await processWebhook(dollar.body, dollar.headers)).kind).toBe(
      "ignored",
    );
    expect(await getBalance(OWNER, "forms")).toBe(0);
  });

  it("completes a settlement whose delivery died before crediting", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { billingEvents, billingOrders } =
      await import("@/lib/server/db/collections");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);

    // Recreate the crash: the event was recorded, the order was claimed
    // (paid), but the credit never landed — five minutes ago.
    const crashedAt = new Date(Date.now() - 5 * 60_000);
    await (
      await billingEvents()
    ).insertOne({
      gateway: "razorpay",
      eventId: "pay_test_1",
      orderId,
      processedAt: crashedAt,
    });
    await (
      await billingOrders()
    ).updateOne({ orderId }, { $set: { status: "paid", paidAt: crashedAt } });

    // The retry must finish the credit rather than call it a duplicate.
    const delivery = signedDelivery(orderId);
    expect((await processWebhook(delivery.body, delivery.headers)).kind).toBe(
      "credited",
    );
    expect(await getBalance(OWNER, "forms")).toBe(500);

    // Exactly once, even on a further retry.
    expect((await processWebhook(delivery.body, delivery.headers)).kind).toBe(
      "duplicate",
    );
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("does not race a settlement that is still in flight", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const orderId = await seedOrder(500);
    const delivery = signedDelivery(orderId);

    // Two deliveries within the lease window: the loser must defer, not
    // "repair" a live winner into a double credit.
    const outcomes = await Promise.all([
      processWebhook(delivery.body, delivery.headers),
      processWebhook(delivery.body, delivery.headers),
    ]);
    expect(outcomes.filter((o) => o.kind === "credited")).toHaveLength(1);
    expect(await getBalance(OWNER, "forms")).toBe(500);
  });

  it("marks the order failed when the payment fails", async () => {
    const { processWebhook } = await import("@/lib/server/billing/webhook");
    const { getOrder } = await import("@/lib/server/billing/orders");
    const orderId = await seedOrder();

    const body = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay_failed", notes: { orderId } } },
      },
    });
    const headers = new Headers({
      "x-razorpay-signature": createHmac("sha256", SECRET)
        .update(body)
        .digest("hex"),
    });

    const outcome = await processWebhook(body, headers);
    expect(outcome.kind).toBe("ignored");
    expect((await getOrder(orderId))?.status).toBe("failed");
  });
});
