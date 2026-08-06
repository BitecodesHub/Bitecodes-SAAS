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

  function signedDelivery(orderId: string, paymentId = "pay_test_1") {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: paymentId, notes: { orderId } } },
      },
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
});
