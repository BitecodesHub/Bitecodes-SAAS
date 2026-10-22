import { beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { NormalizedProspect } from "@/lib/prospecting/normalize";
import type {
  ProspectClassification,
  ProspectResearch,
} from "@/lib/server/db/types";

// `updateSettings` revalidates a Next.js cache tag, which needs a request
// store this process does not have.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

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

function classification(): ProspectClassification {
  return {
    primaryTag: "no-website",
    tags: ["no-website"],
    score: 88,
    pitchAngles: ["No website at all."],
    topIssues: ["No website found"],
  };
}

async function seedProspect(
  overrides: Partial<NormalizedProspect> = {},
): Promise<string> {
  const { upsertDiscoveredProspects, saveEnrichment } =
    await import("@/lib/server/prospecting/repository");
  const { insertedIds } = await upsertDiscoveredProspects("s1", [
    normalized(overrides),
  ]);
  const id = insertedIds[0]!;
  await saveEnrichment(id, {
    signals: null,
    classification: classification(),
    auditScore: null,
  });
  // Enrichment alone does not promote a prospect; qualification does.
  const { prospects: collection } = await import("@/lib/server/db/collections");
  await (
    await collection()
  ).updateOne(
    { email: overrides.email ?? "owner@rossi.example.com" },
    { $set: { status: "qualified" } },
  );
  return id;
}

function research(overrides: Partial<ProspectResearch> = {}): ProspectResearch {
  return {
    summary: "A restaurant with no website.",
    likelyNeeds: ["Website"],
    icpSegmentId: null,
    fitScore: 80,
    personalizationHooks: [],
    risks: [],
    recommendedService: null,
    doNotContactReason: null,
    model: "test",
    provider: "test",
    createdAt: new Date(),
    ...overrides,
  };
}

function context(deadline = Date.now() + 60_000) {
  return {
    jobId: "job-1",
    attempts: 1,
    deadline,
    log: vi.fn(),
  };
}

describeWithDatabase("outreach.draft handler", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { prospects, siteSettings } =
      await import("@/lib/server/db/collections");
    await (await prospects()).deleteMany({});
    await (await siteSettings()).deleteMany({});
  });

  it("accepts the scheduled { date } payload instead of throwing", async () => {
    // The cadence registry enqueues every daily job with `{ date }`. The
    // handler previously required `prospectId`, so every scheduled run failed.
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");

    const result = await handleOutreachDraft({ date: "2026-10-22" }, context());

    expect(result).toMatchObject({ candidates: 0, drafted: 0 });
  });

  it("honours the growth toggle", async () => {
    const { updateSettings } = await import("@/lib/server/settings");
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");

    await updateSettings({ growth: { outreachDrafts: false } });
    expect(
      await handleOutreachDraft({ date: "2026-10-22" }, context()),
    ).toEqual({ skipped: "disabled" });
  });

  it("selects only qualified, contactable prospects without a draft", async () => {
    const { prospects: collection } =
      await import("@/lib/server/db/collections");
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");

    // The one candidate.
    await seedProspect();
    // Filtered out: no address.
    await seedProspect({ sourceId: "node/2", email: null });
    // Filtered out: not qualified.
    await seedProspect({
      sourceId: "node/3",
      email: "unqualified@example.com",
    });
    await (
      await collection()
    ).updateOne(
      { email: "unqualified@example.com" },
      { $set: { status: "discovered" } },
    );
    // Filtered out: already drafted.
    await seedProspect({
      sourceId: "node/4",
      email: "drafted@example.com",
    });
    await (
      await collection()
    ).updateOne(
      { email: "drafted@example.com" },
      { $set: { outreachDraftedAt: new Date() } },
    );

    // A deadline too close prevents the AI call while still proving which
    // prospects the batch selected.
    const result = await handleOutreachDraft(
      { date: "2026-10-22" },
      context(Date.now() + 1_000),
    );
    expect(result).toMatchObject({ candidates: 1, drafted: 0 });
  });

  it("reports a missing prospect without failing the job", async () => {
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");
    const result = await handleOutreachDraft(
      { prospectId: "0123456789abcdef01234567" },
      context(),
    );
    expect(result).toEqual({ skipped: "missing" });
  });

  it("stays idempotent for a prospect that already has a draft", async () => {
    const { prospects: collection } =
      await import("@/lib/server/db/collections");
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");

    const id = await seedProspect();
    await (
      await collection()
    ).updateOne(
      { _id: { $exists: true } },
      { $set: { outreachDraftedAt: new Date() } },
    );

    const result = await handleOutreachDraft({ prospectId: id }, context());
    expect(result).toMatchObject({ drafted: false, skipped: "idempotent" });
  });

  it("skips a prospect research marked do-not-contact", async () => {
    const { prospects: collection } =
      await import("@/lib/server/db/collections");
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");

    const id = await seedProspect();
    await (
      await collection()
    ).updateOne(
      { _id: { $exists: true } },
      {
        $set: {
          research: research({ doNotContactReason: "A direct competitor." }),
        },
      },
    );

    const result = await handleOutreachDraft({ prospectId: id }, context());
    expect(result).toMatchObject({ drafted: false, skipped: "do-not-contact" });
  });

  it("stops before the AI call when the run deadline is too close", async () => {
    const { handleOutreachDraft } =
      await import("@/lib/server/jobs/handlers/outreach-draft");

    await seedProspect();
    const result = await handleOutreachDraft(
      { date: "2026-10-22" },
      context(Date.now() + 1_000),
    );
    expect(result).toMatchObject({ candidates: 1, drafted: 0 });
    expect(
      (result as { skipped: Record<string, number> }).skipped.deadline,
    ).toBe(1);
  });
});
