import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { NormalizedProspect } from "@/lib/prospecting/normalize";
import type { ProspectClassification } from "@/lib/server/db/types";

/**
 * The sequence engine.
 *
 * The tests that matter here are the ones about *not* sending: a duplicate step,
 * a follow-up to someone who unsubscribed, or a follow-up to someone a human is
 * already talking to. Those are the failures that turn outreach into a complaint.
 */

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
    phone: null,
    email: "owner@rossi.example.com",
    website: null,
    socialUrl: null,
    address: null,
    city: "Ahmedabad",
    region: null,
    postcode: null,
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

async function seedProspect(
  overrides: Partial<NormalizedProspect> = {},
  classify: ProspectClassification | null = classification(),
): Promise<string> {
  const { upsertDiscoveredProspects, saveEnrichment } =
    await import("@/lib/server/prospecting/repository");
  const { insertedIds } = await upsertDiscoveredProspects("s1", [
    normalized(overrides),
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

describeWithDatabase("sequence engine", () => {
  useTestDatabase();

  beforeEach(async () => {
    const {
      prospects,
      emailMessages,
      emailTemplates,
      emailSequences,
      sequenceEnrollments,
      suppressions,
      siteSettings,
    } = await import("@/lib/server/db/collections");
    for (const collection of [
      await prospects(),
      await emailMessages(),
      await emailTemplates(),
      await emailSequences(),
      await sequenceEnrollments(),
      await suppressions(),
      await siteSettings(),
    ]) {
      await collection.deleteMany({});
    }
    process.env.OUTREACH_POSTAL_ADDRESS ??= "1 Example Road, Ahmedabad";
  });

  it("seeds the follow-up templates and the default sequence", async () => {
    const { ensureSeededSequences, getSequence } =
      await import("@/lib/server/email/sequences");

    const result = await ensureSeededSequences();
    expect(result.templates).toBe(2);
    expect(result.sequences).toBe(1);

    const sequence = await getSequence("outreach.default");
    expect(sequence?.steps).toHaveLength(3);
    // Step one is resolved per recipient from their classification tag.
    expect(sequence?.steps[0]!.templateKey).toBe("");
    expect(sequence?.steps[1]!.templateKey).toBe("followup.nudge");
    expect(sequence?.steps[2]!.templateKey).toBe("followup.final");
    expect(sequence?.stopOnClick).toBe(true);
  });

  it("is idempotent when seeded twice", async () => {
    const { ensureSeededSequences } =
      await import("@/lib/server/email/sequences");
    await ensureSeededSequences();
    expect(await ensureSeededSequences()).toEqual({
      templates: 0,
      sequences: 0,
    });
  });

  it("enrols a prospect and sends step one with their tag's template", async () => {
    const { enrollProspect } = await import("@/lib/server/email/sequences");
    const { emailMessages, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    const id = await seedProspect();
    const result = await enrollProspect(id);
    expect(result.ok).toBe(true);

    const messages = await (await emailMessages()).find({}).toArray();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.templateKey).toBe("outreach.no-website");
    expect(messages[0]!.sequenceStep).toBe(1);

    const enrollment = await (await sequenceEnrollments()).findOne({});
    expect(enrollment?.currentStep).toBe(1);
    expect(enrollment?.status).toBe("active");
    // Step two scheduled four days out.
    expect(enrollment?.nextRunAt).toBeInstanceOf(Date);
  });

  it("refuses a second enrolment while one is running", async () => {
    // Two concurrent sequences to one person would interleave follow-ups.
    const { enrollProspect } = await import("@/lib/server/email/sequences");
    const id = await seedProspect();

    expect((await enrollProspect(id)).ok).toBe(true);
    const second = await enrollProspect(id);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("already-enrolled");
  });

  it("refuses to enrol an unchecked or unreachable prospect", async () => {
    const { enrollProspect } = await import("@/lib/server/email/sequences");

    const unchecked = await seedProspect({ sourceId: "node/2" }, null);
    const a = await enrollProspect(unchecked);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe("not-classified");

    const noEmail = await seedProspect({ sourceId: "node/3", email: null });
    const b = await enrollProspect(noEmail);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe("no-email");
  });

  it("sends step two only once it is due", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { emailMessages } = await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);

    // Nothing due yet.
    expect((await tickSequences(new Date())).sent).toBe(0);
    expect(await (await emailMessages()).countDocuments({})).toBe(1);

    // Four days later.
    const later = new Date(Date.now() + 97 * 3_600_000);
    const summary = await tickSequences(later);
    expect(summary.sent).toBe(1);

    const messages = await (await emailMessages())
      .find({})
      .sort({ sequenceStep: 1 })
      .toArray();
    expect(messages).toHaveLength(2);
    expect(messages[1]!.templateKey).toBe("followup.nudge");
    expect(messages[1]!.sequenceStep).toBe(2);
  });

  it("completes after the final step and sends no more", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { emailMessages, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);

    await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    await tickSequences(new Date(Date.now() + 400 * 3_600_000));

    const enrollment = await (await sequenceEnrollments()).findOne({});
    expect(enrollment?.status).toBe("completed");
    expect(enrollment?.nextRunAt).toBeNull();
    expect(await (await emailMessages()).countDocuments({})).toBe(3);

    // Far in the future: a completed sequence must stay silent.
    const after = await tickSequences(new Date(Date.now() + 9_000 * 3_600_000));
    expect(after.due).toBe(0);
    expect(await (await emailMessages()).countDocuments({})).toBe(3);
  });

  it("never sends the same step twice under concurrent ticks", async () => {
    // The claim is an atomic increment, so two workers racing cannot both send
    // step two. This is the single most damaging bug an outreach system can have.
    const { enrollProspect, advanceEnrollment } =
      await import("@/lib/server/email/sequences");
    const { emailMessages, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);
    const enrollment = await (await sequenceEnrollments()).findOne({});
    const due = new Date(Date.now() + 97 * 3_600_000);

    const [first, second] = await Promise.all([
      advanceEnrollment(enrollment!.enrollmentId, due),
      advanceEnrollment(enrollment!.enrollmentId, due),
    ]);

    // Exactly one of the two may have sent.
    expect([first.sent, second.sent].filter(Boolean)).toHaveLength(1);
    expect(
      await (await emailMessages()).countDocuments({ sequenceStep: 2 }),
    ).toBe(1);
  });

  it("stops before step two when the recipient unsubscribed", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { applyUnsubscribe } = await import("@/lib/server/email/unsubscribe");
    const { createSignedToken } = await import("@/lib/server/tokens");
    const { emailMessages, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);

    await applyUnsubscribe(
      createSignedToken({
        purpose: "unsubscribe",
        data: { e: "owner@rossi.example.com", id },
      }),
    );

    // Unsubscribing alone should already have stopped the enrolment.
    const stopped = await (await sequenceEnrollments()).findOne({});
    expect(stopped?.status).toBe("stopped");
    expect(stopped?.stoppedReason).toBe("unsubscribed");

    const summary = await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    expect(summary.sent).toBe(0);
    expect(await (await emailMessages()).countDocuments({})).toBe(1);
  });

  it("stops when the recipient clicked", async () => {
    // A click means a person should take over; a scripted nudge afterwards reads
    // as nobody being home.
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { emailMessages, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    const id = await seedProspect();
    const enrolled = await enrollProspect(id);
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) return;

    await (
      await emailMessages()
    ).updateOne(
      { enrollmentId: enrolled.enrollmentId },
      { $set: { clicks: [{ url: "https://example.com", at: new Date() }] } },
    );

    const summary = await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    expect(summary.sent).toBe(0);
    expect(summary.stoppedReasons.clicked).toBe(1);

    const enrollment = await (await sequenceEnrollments()).findOne({});
    expect(enrollment?.status).toBe("stopped");
    expect(enrollment?.stoppedReason).toBe("clicked");
  });

  it("stops when a human has taken the prospect over", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { setProspectStatus } =
      await import("@/lib/server/prospecting/repository");
    const { sequenceEnrollments } = await import("@/lib/server/db/collections");

    for (const status of ["replied", "meeting", "won", "lost"] as const) {
      const {
        prospects,
        emailMessages,
        sequenceEnrollments: enr,
      } = await import("@/lib/server/db/collections");
      await (await prospects()).deleteMany({});
      await (await emailMessages()).deleteMany({});
      await (await enr()).deleteMany({});

      const id = await seedProspect();
      await enrollProspect(id);
      await setProspectStatus([id], status);

      const summary = await tickSequences(
        new Date(Date.now() + 97 * 3_600_000),
      );
      expect(summary.sent, status).toBe(0);
      expect(summary.stoppedReasons["prospect-advanced"], status).toBe(1);

      const enrollment = await (await sequenceEnrollments()).findOne({});
      expect(enrollment?.stoppedReason, status).toBe("prospect-advanced");
    }
  });

  it("stops when the sequence is switched off mid-flight", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { emailSequences, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);

    await (
      await emailSequences()
    ).updateOne({ key: "outreach.default" }, { $set: { enabled: false } });

    const summary = await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    expect(summary.sent).toBe(0);
    expect(
      (await (await sequenceEnrollments()).findOne({}))?.stoppedReason,
    ).toBe("sequence-disabled");
  });

  it("stops when the step's template has been switched off", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { updateTemplate } = await import("@/lib/server/email/templates");
    const { sequenceEnrollments } = await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);
    await updateTemplate("followup.nudge", { enabled: false });

    const summary = await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    expect(summary.sent).toBe(0);
    expect(
      (await (await sequenceEnrollments()).findOne({}))?.stoppedReason,
    ).toBe("no-template");
  });

  it("stops when the prospect is deleted", async () => {
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { deleteProspects } =
      await import("@/lib/server/prospecting/repository");
    const { sequenceEnrollments } = await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);
    await deleteProspects([id]);

    const summary = await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    expect(summary.sent).toBe(0);
    expect((await (await sequenceEnrollments()).findOne({}))?.status).toBe(
      "stopped",
    );
  });

  it("reports enrolment statistics for the panel", async () => {
    const { enrollProspect, stopEnrollment, getEnrollmentStats } =
      await import("@/lib/server/email/sequences");

    const a = await enrollProspect(await seedProspect({ sourceId: "node/10" }));
    await enrollProspect(
      await seedProspect({ sourceId: "node/11", email: "b@example.com" }),
    );
    if (a.ok) await stopEnrollment(a.enrollmentId, "clicked");

    const stats = await getEnrollmentStats();
    expect(stats.active).toBe(1);
    expect(stats.stopped).toBe(1);
    expect(stats.byStopReason.clicked).toBe(1);
  });

  it("every follow-up carries an unsubscribe link", async () => {
    // Someone who ignored the first email must not have to hunt for the exit.
    const { enrollProspect, tickSequences } =
      await import("@/lib/server/email/sequences");
    const { emailMessages } = await import("@/lib/server/db/collections");

    const id = await seedProspect();
    await enrollProspect(id);
    await tickSequences(new Date(Date.now() + 97 * 3_600_000));
    await tickSequences(new Date(Date.now() + 400 * 3_600_000));

    const messages = await (await emailMessages()).find({}).toArray();
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.text).toContain("/api/unsubscribe");
      expect(message.html).toContain("/api/unsubscribe");
      // No unrendered placeholder may reach a recipient.
      expect(message.text).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });
});
