import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * The opt-out path.
 *
 * This is the single most consequential piece of the outreach system: if it does
 * not work, the company keeps emailing people who asked it to stop. So the
 * assertions here are deliberately about *effect* — is the address actually on
 * the suppression list, and does a later send actually refuse — rather than about
 * return values.
 */

async function mintToken(email: string, prospectId?: string) {
  const { createSignedToken } = await import("@/lib/server/tokens");
  return createSignedToken({
    purpose: "unsubscribe",
    data: prospectId ? { e: email, id: prospectId } : { e: email },
  });
}

describeWithDatabase("unsubscribe", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { suppressions, prospects, emailMessages, emailTemplates } =
      await import("@/lib/server/db/collections");
    await (await suppressions()).deleteMany({});
    await (await prospects()).deleteMany({});
    await (await emailMessages()).deleteMany({});
    await (await emailTemplates()).deleteMany({});
    process.env.OUTREACH_POSTAL_ADDRESS ??= "1 Example Road, Ahmedabad";
  });

  it("suppresses the address from a valid token", async () => {
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { isSuppressed } = await import("@/lib/server/email/suppression");

    const outcome = await applyUnsubscribe(
      await mintToken("owner@rossi.example.com"),
    );

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.email).toBe("owner@rossi.example.com");
    expect(await isSuppressed("owner@rossi.example.com")).toBe(true);
  });

  it("refuses a forged or malformed token without suppressing anything", async () => {
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { countSuppressions } =
      await import("@/lib/server/email/suppression");

    for (const bad of ["", "garbage", "a.b", null, undefined]) {
      const outcome = await applyUnsubscribe(bad);
      expect(outcome.ok, String(bad)).toBe(false);
    }
    expect(await countSuppressions()).toBe(0);
  });

  it("refuses a token signed for a different purpose", async () => {
    // A report link must not double as an unsubscribe link, and vice versa.
    const { createSignedToken } = await import("@/lib/server/tokens");
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");

    const reportToken = createSignedToken({
      purpose: "report",
      data: { e: "owner@rossi.example.com" },
    });

    const outcome = await applyUnsubscribe(reportToken);
    expect(outcome.ok).toBe(false);
  });

  it("honours a token whose signature is valid but which has expired", async () => {
    // Unsubscribe tokens are minted without expiry so this should never arise,
    // but refusing to honour a clear opt-out over a timestamp is indefensible.
    const { createSignedToken } = await import("@/lib/server/tokens");
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { isSuppressed } = await import("@/lib/server/email/suppression");

    const expired = createSignedToken({
      purpose: "unsubscribe",
      data: { e: "late@rossi.example.com" },
      ttlSeconds: -10,
    });

    const outcome = await applyUnsubscribe(expired);
    expect(outcome.ok).toBe(true);
    expect(await isSuppressed("late@rossi.example.com")).toBe(true);
  });

  it("is idempotent — clicking twice is not an error", async () => {
    // Mail clients prefetch links, and people click twice.
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { countSuppressions } =
      await import("@/lib/server/email/suppression");

    const token = await mintToken("owner@rossi.example.com");
    expect((await applyUnsubscribe(token)).ok).toBe(true);
    expect((await applyUnsubscribe(token)).ok).toBe(true);
    expect(await countSuppressions()).toBe(1);
  });

  it("marks the linked prospect as suppressed", async () => {
    const { upsertDiscoveredProspects, getProspect } =
      await import("@/lib/server/prospecting/repository");
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      {
        sourceId: "node/1",
        dedupeKey: "cafe rossi|23.023|72.571",
        name: "Café Rossi",
        category: null,
        categoryId: null,
        categoryLabel: null,
        phone: null,
        email: "owner@rossi.example.com",
        website: null,
        socialUrl: null,
        address: null,
        city: null,
        region: null,
        postcode: null,
        countryCode: null,
        lat: 23.0225,
        lng: 72.5714,
      },
    ]);
    const id = insertedIds[0]!;

    await applyUnsubscribe(await mintToken("owner@rossi.example.com", id));
    expect((await getProspect(id))?.status).toBe("suppressed");
  });

  it("still suppresses when the linked prospect no longer exists", async () => {
    // Deleting a prospect must not break their opt-out.
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { isSuppressed } = await import("@/lib/server/email/suppression");

    const outcome = await applyUnsubscribe(
      await mintToken("gone@rossi.example.com", "6a662ba0e453bdd310d2fa53"),
    );

    expect(outcome.ok).toBe(true);
    expect(await isSuppressed("gone@rossi.example.com")).toBe(true);
  });

  it("actually stops the next outreach email", async () => {
    // The property that matters. Everything above is machinery; this is the
    // promise made to the recipient.
    const { upsertDiscoveredProspects, saveEnrichment } =
      await import("@/lib/server/prospecting/repository");
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      {
        sourceId: "node/2",
        dedupeKey: "bianchi|23.023|72.571",
        name: "Bianchi",
        category: null,
        categoryId: null,
        categoryLabel: null,
        phone: null,
        email: "stop@bianchi.example.com",
        website: null,
        socialUrl: null,
        address: null,
        city: "Ahmedabad",
        region: null,
        postcode: null,
        countryCode: "IN",
        lat: 23.0225,
        lng: 72.5714,
      },
    ]);
    const id = insertedIds[0]!;
    await saveEnrichment(id, {
      signals: null,
      classification: {
        primaryTag: "no-website",
        tags: ["no-website"],
        score: 88,
        pitchAngles: ["No website at all."],
        topIssues: ["No website found"],
      },
      auditScore: null,
    });

    await applyUnsubscribe(await mintToken("stop@bianchi.example.com", id));

    const outcome = await prepareProspectOutreach(id, { force: true });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("suppressed-or-capped");
  });

  it("normalises the address so case cannot bypass suppression", async () => {
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { isSuppressed } = await import("@/lib/server/email/suppression");

    await applyUnsubscribe(await mintToken("Owner@Rossi.Example.COM"));

    // A later send addressed in a different case must still be blocked.
    expect(await isSuppressed("owner@rossi.example.com")).toBe(true);
    expect(await isSuppressed("OWNER@ROSSI.EXAMPLE.COM")).toBe(true);
  });
});
