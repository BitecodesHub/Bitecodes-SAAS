import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { NormalizedProspect } from "@/lib/prospecting/normalize";
import type { ProspectClassification } from "@/lib/server/db/types";

function normalized(
  overrides: Partial<NormalizedProspect> = {},
): NormalizedProspect {
  return {
    sourceId: "node/1",
    dedupeKey: "cafe rossi|23.023|72.571",
    name: "Café Rossi",
    category: "amenity=restaurant",
    categoryId: "food-drink",
    categoryLabel: "Restaurant",
    phone: "+919428767709",
    email: "hello@rossi.example.com",
    website: null,
    socialUrl: null,
    address: "12 CG Road",
    city: "Ahmedabad",
    region: "Gujarat",
    postcode: "380009",
    countryCode: "IN",
    lat: 23.0225,
    lng: 72.5714,
    ...overrides,
  };
}

function classification(
  overrides: Partial<ProspectClassification> = {},
): ProspectClassification {
  return {
    primaryTag: "no-website",
    tags: ["no-website"],
    score: 88,
    pitchAngles: ["No website at all."],
    topIssues: ["No website found"],
    ...overrides,
  };
}

/** Creates a prospect and optionally classifies it. Returns its id. */
async function seedProspect(
  input: Partial<NormalizedProspect> = {},
  classify: ProspectClassification | null = classification(),
): Promise<string> {
  const { upsertDiscoveredProspects, saveEnrichment } =
    await import("@/lib/server/prospecting/repository");
  const { insertedIds } = await upsertDiscoveredProspects("test-search", [
    normalized(input),
  ]);
  const id = insertedIds[0]!;

  if (classify) {
    await saveEnrichment(id, {
      signals: null,
      classification: classify,
      auditScore: null,
    });
  }
  return id;
}

describeWithDatabase("outreach planner", () => {
  useTestDatabase();

  beforeEach(async () => {
    const {
      prospects,
      emailMessages,
      emailTemplates,
      suppressions,
      siteSettings,
    } = await import("@/lib/server/db/collections");
    await (await prospects()).deleteMany({});
    await (await emailMessages()).deleteMany({});
    await (await emailTemplates()).deleteMany({});
    await (await suppressions()).deleteMany({});
    await (await siteSettings()).deleteMany({});
    process.env.OUTREACH_POSTAL_ADDRESS ??= "1 Example Road, Ahmedabad";
  });

  it("queues an email using the template for the prospect's tag", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const id = await seedProspect();

    const outcome = await prepareProspectOutreach(id);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // The classifier's decision selected the template. That join is the whole
    // point of the feature.
    expect(outcome.templateKey).toBe("outreach.no-website");
  });

  it("selects a different template for a different tag", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const id = await seedProspect(
      { website: "https://rossi.example.com/" },
      classification({
        primaryTag: "not-mobile-friendly",
        tags: ["not-mobile-friendly"],
        topIssues: ["Not usable on a phone"],
      }),
    );

    const outcome = await prepareProspectOutreach(id);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.templateKey).toBe("outreach.not-mobile-friendly");
    }
  });

  it("refuses to email a prospect that has not been checked", async () => {
    // The last guard against the false-claim failure: with no classification
    // there is no verified reason to contact them, so there is nothing honest
    // to say.
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const id = await seedProspect({}, null);

    const outcome = await prepareProspectOutreach(id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("not-classified");
  });

  it("refuses when there is no email address", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const id = await seedProspect({ email: null });

    const outcome = await prepareProspectOutreach(id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("no-email");
  });

  it("refuses a second first-contact email", async () => {
    // Re-sending first contact is the fastest route to being marked spam.
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const id = await seedProspect();

    expect((await prepareProspectOutreach(id)).ok).toBe(true);

    const second = await prepareProspectOutreach(id);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("already-contacted");
  });

  it("allows a deliberate re-send when forced", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const id = await seedProspect();

    await prepareProspectOutreach(id);
    expect((await prepareProspectOutreach(id, { force: true })).ok).toBe(true);
  });

  it("refuses when the tag's template is disabled", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const { ensureSeededTemplates, updateTemplate } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    await updateTemplate("outreach.no-website", { enabled: false });

    const id = await seedProspect();
    const outcome = await prepareProspectOutreach(id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("no-template");
  });

  it("records the contact at queue time, not at delivery", async () => {
    // Counting later would let a stalled queue produce a second first-contact
    // email to the same person.
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const { getProspect } = await import("@/lib/server/prospecting/repository");
    const id = await seedProspect();

    await prepareProspectOutreach(id);
    const after = await getProspect(id);
    expect(after?.contactCount).toBe(1);
    expect(after?.lastContactedAt).toBeInstanceOf(Date);
  });

  it("respects the suppression list", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const { addSuppression } = await import("@/lib/server/email/suppression");

    await addSuppression("hello@rossi.example.com", "unsubscribed");
    const id = await seedProspect();

    const outcome = await prepareProspectOutreach(id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("suppressed-or-capped");
  });

  it("does not count a suppressed prospect as contacted", async () => {
    // Nothing was sent, so marking them contacted would permanently exclude
    // them from a future, legitimate send.
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const { addSuppression } = await import("@/lib/server/email/suppression");
    const { getProspect } = await import("@/lib/server/prospecting/repository");

    await addSuppression("hello@rossi.example.com", "unsubscribed");
    const id = await seedProspect();
    await prepareProspectOutreach(id);

    expect((await getProspect(id))?.contactCount).toBe(0);
  });

  it("fills every variable, leaving no placeholder in the queued message", async () => {
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const { emailMessages } = await import("@/lib/server/db/collections");
    const id = await seedProspect();

    await prepareProspectOutreach(id);
    const message = await (await emailMessages()).findOne({ prospectId: id });

    expect(message).toBeTruthy();
    expect(message!.subject).toContain("Café Rossi");
    // An unrendered placeholder reaching a stranger's inbox is the visible
    // failure this guards.
    expect(message!.html).not.toMatch(/\{\{[^}]+\}\}/);
    expect(message!.text).not.toMatch(/\{\{[^}]+\}\}/);
    // Compliance essentials for commercial mail.
    expect(message!.html).toContain("unsubscribe");
    expect(message!.text.length).toBeGreaterThan(80);
  });

  it("substitutes a readable fallback for a missing city", async () => {
    // "businesses in ." would be the alternative.
    const { prepareProspectOutreach } =
      await import("@/lib/server/email/outreach");
    const { emailMessages } = await import("@/lib/server/db/collections");
    const id = await seedProspect({ city: null });

    await prepareProspectOutreach(id);
    const message = await (await emailMessages()).findOne({ prospectId: id });
    expect(message!.text).toContain("your area");
  });

  it("spaces a bulk send out over time rather than sending at once", async () => {
    // A hundred messages leaving in the same second is the clearest spam signal
    // a new sending domain can produce.
    const { prepareBulkOutreach } = await import("@/lib/server/email/outreach");
    const { emailMessages } = await import("@/lib/server/db/collections");

    const ids = [
      await seedProspect({ sourceId: "node/1", email: "a@example.com" }),
      await seedProspect({ sourceId: "node/2", email: "b@example.com" }),
      await seedProspect({ sourceId: "node/3", email: "c@example.com" }),
    ];

    const summary = await prepareBulkOutreach(ids, {
      spacingSeconds: 60,
      startAt: new Date("2026-07-26T10:00:00.000Z"),
    });
    expect(summary.queued).toBe(3);
    expect(summary.skipped).toEqual([]);

    const messages = await (await emailMessages())
      .find({})
      .sort({ sendAfter: 1 })
      .toArray();
    const times = messages.map((m) => m.sendAfter.getTime());
    expect(times[1]! - times[0]!).toBe(60_000);
    expect(times[2]! - times[1]!).toBe(60_000);
  });

  it("reports per-prospect reasons from a bulk send", async () => {
    const { prepareBulkOutreach } = await import("@/lib/server/email/outreach");

    const good = await seedProspect({
      sourceId: "node/1",
      email: "a@example.com",
    });
    const noEmail = await seedProspect({ sourceId: "node/2", email: null });
    const unchecked = await seedProspect(
      { sourceId: "node/3", email: "c@example.com" },
      null,
    );

    const summary = await prepareBulkOutreach([good, noEmail, unchecked]);
    expect(summary.queued).toBe(1);
    expect(summary.skipped).toHaveLength(2);
    expect(summary.skipped.map((entry) => entry.reason).sort()).toEqual([
      "no-email",
      "not-classified",
    ]);
  });

  it("enforces a minimum spacing even when asked for none", async () => {
    const { prepareBulkOutreach } = await import("@/lib/server/email/outreach");
    const { emailMessages } = await import("@/lib/server/db/collections");

    const ids = [
      await seedProspect({ sourceId: "node/1", email: "a@example.com" }),
      await seedProspect({ sourceId: "node/2", email: "b@example.com" }),
    ];
    await prepareBulkOutreach(ids, {
      spacingSeconds: 0,
      startAt: new Date("2026-07-26T10:00:00.000Z"),
    });

    const messages = await (await emailMessages())
      .find({})
      .sort({ sendAfter: 1 })
      .toArray();
    expect(
      messages[1]!.sendAfter.getTime() - messages[0]!.sendAfter.getTime(),
    ).toBeGreaterThanOrEqual(15_000);
  });
});
