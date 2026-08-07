import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { HONEYPOT_FIELD } from "@/lib/forms/fields";
import type { FormDoc } from "@/lib/server/db/types";

/**
 * Submission-pipeline tests against a real MongoDB.
 *
 * These cover the properties that protect the product and the customer: the
 * origin boundary, the honeypot spending nothing, exactly-one-credit metering,
 * refusal at zero balance, and no overspend under concurrency.
 */
describeWithDatabase("form submission pipeline", () => {
  useTestDatabase();

  const OWNER = "owner-s";
  const ORIGIN = "https://example.com";

  async function seedForm(overrides: Partial<FormDoc> = {}): Promise<FormDoc> {
    const { createForm, getForm } =
      await import("@/lib/server/forms/repository");
    const { formId } = await createForm({
      ownerId: OWNER,
      name: "Contact",
      allowedDomains: ["example.com"],
    });
    if (Object.keys(overrides).length > 0) {
      // Written directly so a test can set fields the public API does not expose.
      const { forms } = await import("@/lib/server/db/collections");
      await (await forms()).updateOne({ formId }, { $set: overrides });
    }
    return (await getForm(OWNER, formId))!;
  }

  async function fund(amount: number) {
    const { credit } = await import("@/lib/server/wallet/wallet");
    await credit({
      ownerId: OWNER,
      product: "forms",
      amount,
      kind: "purchase",
    });
  }

  function payload(extra: Record<string, unknown> = {}) {
    return {
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello there, I would like a quote.",
      ...extra,
    };
  }

  beforeEach(async () => {
    const { forms, formSubmissions, walletBalances, walletLedger, rateLimits } =
      await import("@/lib/server/db/collections");
    await (await forms()).deleteMany({});
    await (await formSubmissions()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
    await (await rateLimits()).deleteMany({});
  });

  it("accepts a valid submission, spending exactly one credit", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { listSubmissions } = await import("@/lib/server/forms/repository");
    const form = await seedForm();
    await fund(5);

    const outcome = await handleSubmission({
      form,
      payload: payload(),
      origin: ORIGIN,
      ip: "203.0.113.5",
      userAgent: "test",
      referrer: null,
    });

    expect(outcome.kind).toBe("ok");
    expect(await getBalance(OWNER, "forms")).toBe(4);
    const stored = await listSubmissions(OWNER, form.formId);
    expect(stored).toHaveLength(1);
    expect(stored[0].data.email).toBe("ada@example.com");
    // The visitor's IP is stored only as a hash.
    expect(stored[0].meta.ipHash).toBeTruthy();
    expect(stored[0].meta.ipHash).not.toBe("203.0.113.5");
  });

  it("refuses a disallowed origin without spending or storing", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { listSubmissions } = await import("@/lib/server/forms/repository");
    const form = await seedForm();
    await fund(5);

    const outcome = await handleSubmission({
      form,
      payload: payload(),
      origin: "https://attacker.example.net",
      ip: "203.0.113.5",
      userAgent: null,
      referrer: null,
    });

    expect(outcome.kind).toBe("origin-denied");
    expect(await getBalance(OWNER, "forms")).toBe(5);
    expect(await listSubmissions(OWNER, form.formId)).toHaveLength(0);
  });

  it("fakes success for a tripped honeypot, spending and storing nothing", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { listSubmissions } = await import("@/lib/server/forms/repository");
    const form = await seedForm();
    await fund(5);

    const outcome = await handleSubmission({
      form,
      payload: payload({ [HONEYPOT_FIELD]: "http://spam.example" }),
      origin: ORIGIN,
      ip: "203.0.113.9",
      userAgent: "bot",
      referrer: null,
    });

    // Indistinguishable from success to the caller — bots learn nothing.
    expect(outcome.kind).toBe("ok-silent");
    expect(await getBalance(OWNER, "forms")).toBe(5);
    expect(await listSubmissions(OWNER, form.formId)).toHaveLength(0);
  });

  it("ignores an untripped honeypot and does not store it as data", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { listSubmissions } = await import("@/lib/server/forms/repository");
    const form = await seedForm();
    await fund(2);

    const outcome = await handleSubmission({
      form,
      payload: payload({ [HONEYPOT_FIELD]: "" }),
      origin: ORIGIN,
      ip: "203.0.113.10",
      userAgent: null,
      referrer: null,
    });

    expect(outcome.kind).toBe("ok");
    const [stored] = await listSubmissions(OWNER, form.formId);
    expect(stored.data[HONEYPOT_FIELD]).toBeUndefined();
  });

  it("rejects invalid input with per-field errors and no spend", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const form = await seedForm();
    await fund(3);

    const outcome = await handleSubmission({
      form,
      payload: { name: "Ada", email: "not-an-email", message: "Hi there ok" },
      origin: ORIGIN,
      ip: "203.0.113.11",
      userAgent: null,
      referrer: null,
    });

    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") {
      expect(Object.keys(outcome.fieldErrors)).toContain("email");
    }
    expect(await getBalance(OWNER, "forms")).toBe(3);
  });

  it("rejects unknown keys, so the endpoint cannot store arbitrary data", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const form = await seedForm();
    await fund(3);

    const outcome = await handleSubmission({
      form,
      payload: payload({ smuggled: "value" }),
      origin: ORIGIN,
      ip: "203.0.113.12",
      userAgent: null,
      referrer: null,
    });

    expect(outcome.kind).toBe("invalid");
  });

  it("declines with out-of-credits at zero balance and stores nothing", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { listSubmissions } = await import("@/lib/server/forms/repository");
    const form = await seedForm();
    // No funding at all.

    const outcome = await handleSubmission({
      form,
      payload: payload(),
      origin: ORIGIN,
      ip: "203.0.113.13",
      userAgent: null,
      referrer: null,
    });

    expect(outcome.kind).toBe("out-of-credits");
    expect(await listSubmissions(OWNER, form.formId)).toHaveLength(0);
  });

  it("never stores more submissions than credits under concurrency", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const { getBalance } = await import("@/lib/server/wallet/wallet");
    const { listSubmissions } = await import("@/lib/server/forms/repository");
    const form = await seedForm();
    await fund(3);

    // Ten concurrent submissions against three credits.
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        handleSubmission({
          form,
          payload: payload({ message: `Message number ${i} here.` }),
          origin: ORIGIN,
          // Distinct IPs so the per-visitor limit is not what stops them.
          ip: `203.0.113.${20 + i}`,
          userAgent: null,
          referrer: null,
        }),
      ),
    );

    const accepted = outcomes.filter((o) => o.kind === "ok").length;
    const declined = outcomes.filter((o) => o.kind === "out-of-credits").length;
    expect(accepted).toBe(3);
    expect(declined).toBe(7);
    expect(await getBalance(OWNER, "forms")).toBe(0);
    expect(await listSubmissions(OWNER, form.formId)).toHaveLength(3);
  });

  it("rate-limits a single visitor before the credit pack drains", async () => {
    const { handleSubmission } = await import("@/lib/server/forms/submit");
    const form = await seedForm();
    await fund(100);

    const results = [];
    for (let i = 0; i < 22; i++) {
      results.push(
        await handleSubmission({
          form,
          payload: payload({ message: `Repeated message ${i} here.` }),
          origin: ORIGIN,
          ip: "203.0.113.99",
          userAgent: null,
          referrer: null,
        }),
      );
    }

    // The per-visitor bucket is 20/hour, so the tail must be refused.
    expect(
      results.filter((r) => r.kind === "rate-limited").length,
    ).toBeGreaterThan(0);
    expect(results.filter((r) => r.kind === "ok").length).toBeLessThanOrEqual(
      20,
    );
  });

  it("respects a paused form via the public lookup", async () => {
    const { getFormForPublic, createForm, setFormStatus } =
      await import("@/lib/server/forms/repository");
    const { formId, publicToken } = await createForm({
      ownerId: OWNER,
      name: "Paused",
      allowedDomains: ["example.com"],
    });
    await setFormStatus(OWNER, formId, "paused");
    expect(await getFormForPublic(formId, publicToken)).toBeNull();
  });
});
