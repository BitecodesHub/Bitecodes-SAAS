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
    email: null,
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

describeWithDatabase("prospect repository", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { prospects, prospectSearches } =
      await import("@/lib/server/db/collections");
    await (await prospects()).deleteMany({});
    await (await prospectSearches()).deleteMany({});
  });

  it("inserts new prospects and reports their ids", async () => {
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    const outcome = await upsertDiscoveredProspects("search-1", [
      normalized({ sourceId: "node/1", name: "Rossi" }),
      normalized({ sourceId: "node/2", name: "Bianchi" }),
    ]);

    expect(outcome.inserted).toBe(2);
    expect(outcome.insertedIds).toHaveLength(2);
    expect(outcome.updated).toBe(0);

    const page = await listProspects();
    expect(page.total).toBe(2);
    expect(page.items[0]!.status).toBe("discovered");
    expect(page.items[0]!.searchId).toBe("search-1");
    expect(page.items[0]!.contactCount).toBe(0);
  });

  it("is idempotent: re-running the same discovery inserts nothing new", async () => {
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    const batch = [normalized({ sourceId: "node/1" })];
    await upsertDiscoveredProspects("search-1", batch);
    const second = await upsertDiscoveredProspects("search-2", batch);

    expect(second.inserted).toBe(0);
    expect((await listProspects()).total).toBe(1);
  });

  it("refreshes provider facts on a re-run", async () => {
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", name: "Rossi", phone: null }),
    ]);
    await upsertDiscoveredProspects("s2", [
      normalized({
        sourceId: "node/1",
        name: "Café Rossi Trattoria",
        phone: "+919999999999",
      }),
    ]);

    const [prospect] = (await listProspects()).items;
    expect(prospect!.name).toBe("Café Rossi Trattoria");
    expect(prospect!.phone).toBe("+919999999999");
  });

  it("never destroys operator work on a re-run", async () => {
    // The single most important guarantee in this module: discovery runs
    // repeatedly over the same area, and a half-worked pipeline must survive it.
    const {
      upsertDiscoveredProspects,
      saveEnrichment,
      setProspectStatus,
      addProspectTags,
      addProspectNote,
      setProspectEmail,
      getProspect,
    } = await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1" }),
    ]);
    const id = insertedIds[0]!;

    await saveEnrichment(id, {
      signals: null,
      classification: classification({ score: 91 }),
      auditScore: 40,
    });
    await setProspectStatus([id], "won");
    await addProspectTags([id], ["priority", "called"]);
    await addProspectNote(id, {
      authorId: "user-1",
      authorName: "Ismail",
      body: "Spoke to the owner, wants a quote.",
    });
    await setProspectEmail(id, "owner@rossi.example.com");

    // Re-run discovery over the same area.
    await upsertDiscoveredProspects("s2", [normalized({ sourceId: "node/1" })]);

    const after = await getProspect(id);
    expect(after?.status).toBe("won");
    expect(after?.tags).toEqual(["priority", "called"]);
    expect(after?.notes).toHaveLength(1);
    expect(after?.classification?.score).toBe(91);
    expect(after?.email).toBe("owner@rossi.example.com");
    expect(after?.emailSource).toBe("manual");
  });

  it("does not let a provider email overwrite a manual one", async () => {
    const { upsertDiscoveredProspects, setProspectEmail, getProspect } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1" }),
    ]);
    const id = insertedIds[0]!;
    await setProspectEmail(id, "verified@rossi.example.com");

    await upsertDiscoveredProspects("s2", [
      normalized({ sourceId: "node/1", email: "stale@osm.example.com" }),
    ]);

    expect((await getProspect(id))?.email).toBe("verified@rossi.example.com");
  });

  it("adopts a provider email when the record has none", async () => {
    const { upsertDiscoveredProspects, getProspect } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", email: null }),
    ]);
    const id = insertedIds[0]!;

    await upsertDiscoveredProspects("s2", [
      normalized({ sourceId: "node/1", email: "hi@rossi.example.com" }),
    ]);

    const after = await getProspect(id);
    expect(after?.email).toBe("hi@rossi.example.com");
    expect(after?.emailSource).toBe("provider");
  });

  it("resets the classification when a website first appears", async () => {
    // The old verdict said "no website". Keeping it would email the owner a
    // claim that is now false.
    const { upsertDiscoveredProspects, saveEnrichment, getProspect } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", website: null }),
    ]);
    const id = insertedIds[0]!;
    await saveEnrichment(id, {
      signals: null,
      classification: classification(),
      auditScore: null,
    });

    const outcome = await upsertDiscoveredProspects("s2", [
      normalized({ sourceId: "node/1", website: "https://rossi.example.com/" }),
    ]);

    expect(outcome.changedWebsiteIds).toContain(id);
    const after = await getProspect(id);
    expect(after?.classification).toBeNull();
    expect(after?.enrichedAt).toBeNull();
    expect(after?.website).toBe("https://rossi.example.com/");
  });

  it("keeps the classification when the website is unchanged", async () => {
    const { upsertDiscoveredProspects, saveEnrichment, getProspect } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", website: "https://rossi.example.com/" }),
    ]);
    const id = insertedIds[0]!;
    await saveEnrichment(id, {
      signals: null,
      classification: classification({ primaryTag: "seo-gaps", score: 55 }),
      auditScore: 62,
    });

    const outcome = await upsertDiscoveredProspects("s2", [
      normalized({ sourceId: "node/1", website: "https://rossi.example.com/" }),
    ]);

    expect(outcome.changedWebsiteIds).toEqual([]);
    expect((await getProspect(id))?.classification?.score).toBe(55);
  });

  it("does not treat a website disappearing as a change worth re-enriching", async () => {
    // OSM edits are noisy. A tag being removed is far more often vandalism or a
    // mapping cleanup than a business taking its site down.
    const { upsertDiscoveredProspects, getProspect } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", website: "https://rossi.example.com/" }),
    ]);
    const id = insertedIds[0]!;

    const outcome = await upsertDiscoveredProspects("s2", [
      normalized({ sourceId: "node/1", website: null }),
    ]);

    expect(outcome.changedWebsiteIds).toEqual([]);
    expect((await getProspect(id))?.website).toBeNull();
  });

  it("advances status only from the enrichment states", async () => {
    const {
      upsertDiscoveredProspects,
      markEnriching,
      markQualified,
      setProspectStatus,
      getProspect,
    } = await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1" }),
      normalized({ sourceId: "node/2" }),
    ]);
    const [first, second] = insertedIds as [string, string];

    await markEnriching(first);
    expect((await getProspect(first))?.status).toBe("enriching");
    await markQualified(first);
    expect((await getProspect(first))?.status).toBe("qualified");

    // A prospect already won must not be pulled back to qualified.
    await setProspectStatus([second], "won");
    await markQualified(second);
    expect((await getProspect(second))?.status).toBe("won");
  });

  it("records a contact without regressing a later stage", async () => {
    const {
      upsertDiscoveredProspects,
      setProspectStatus,
      recordProspectContacted,
      getProspect,
    } = await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1" }),
      normalized({ sourceId: "node/2" }),
    ]);
    const [first, second] = insertedIds as [string, string];

    await recordProspectContacted(first);
    const contacted = await getProspect(first);
    expect(contacted?.status).toBe("contacted");
    expect(contacted?.contactCount).toBe(1);
    expect(contacted?.lastContactedAt).toBeInstanceOf(Date);

    await setProspectStatus([second], "replied");
    await recordProspectContacted(second);
    const replied = await getProspect(second);
    expect(replied?.status).toBe("replied");
    expect(replied?.contactCount).toBe(1);
  });

  it("de-duplicates and bounds hand-added tags", async () => {
    const {
      upsertDiscoveredProspects,
      addProspectTags,
      removeProspectTag,
      getProspect,
    } = await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1" }),
    ]);
    const id = insertedIds[0]!;

    await addProspectTags([id], ["vip", "vip", "  ", "a".repeat(80)]);
    const after = await getProspect(id);
    expect(after?.tags).toHaveLength(2);
    expect(after?.tags).toContain("vip");
    expect(after?.tags!.find((tag) => tag.startsWith("a"))).toHaveLength(40);

    await removeProspectTag([id], "vip");
    expect((await getProspect(id))?.tags).not.toContain("vip");
  });

  it("filters, searches, and paginates", async () => {
    const { upsertDiscoveredProspects, saveEnrichment, listProspects } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", name: "Rossi", city: "Ahmedabad" }),
      normalized({ sourceId: "node/2", name: "Bianchi", city: "Mumbai" }),
      normalized({ sourceId: "node/3", name: "Verdi", city: "Ahmedabad" }),
    ]);

    await saveEnrichment(insertedIds[0]!, {
      signals: null,
      classification: classification({ primaryTag: "no-website", score: 90 }),
      auditScore: null,
    });
    await saveEnrichment(insertedIds[1]!, {
      signals: null,
      classification: classification({ primaryTag: "seo-gaps", score: 50 }),
      auditScore: 70,
    });

    expect((await listProspects({ city: "Ahmedabad" })).total).toBe(2);
    expect((await listProspects({ search: "bianc" })).total).toBe(1);
    expect((await listProspects({ tag: "no-website" })).total).toBe(1);
    expect((await listProspects({ minScore: 80 })).total).toBe(1);

    // Highest opportunity first by default.
    const sorted = await listProspects();
    expect(sorted.items[0]!.name).toBe("Rossi");

    const paged = await listProspects({ pageSize: 2, page: 2 });
    expect(paged.items).toHaveLength(1);
    expect(paged.totalPages).toBe(2);
  });

  it("clamps a page number beyond the last page", async () => {
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    await upsertDiscoveredProspects("s1", [normalized({ sourceId: "node/1" })]);
    const page = await listProspects({ page: 99, pageSize: 10 });
    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(1);
  });

  it("treats a regex metacharacter in the search box as literal text", async () => {
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", name: "C++ Coaching (Navrangpura)" }),
      normalized({ sourceId: "node/2", name: "Other" }),
    ]);

    expect((await listProspects({ search: "C++" })).total).toBe(1);
    expect((await listProspects({ search: "(Navrangpura)" })).total).toBe(1);
    // A bare metacharacter must match nothing, not everything.
    expect((await listProspects({ search: ".*" })).total).toBe(0);
  });

  it("filters to prospects that can actually be emailed", async () => {
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", email: "a@example.com" }),
      normalized({ sourceId: "node/2", email: null }),
    ]);

    expect((await listProspects({ emailOnly: true })).total).toBe(1);
  });

  it("reports stats by tag, status, and city", async () => {
    const { upsertDiscoveredProspects, saveEnrichment, getProspectStats } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1", city: "Ahmedabad", email: "a@b.com" }),
      normalized({ sourceId: "node/2", city: "Ahmedabad" }),
    ]);
    await saveEnrichment(insertedIds[0]!, {
      signals: null,
      classification: classification({ primaryTag: "no-website" }),
      auditScore: null,
    });

    const stats = await getProspectStats();
    expect(stats.total).toBe(2);
    expect(stats.withEmail).toBe(1);
    expect(stats.byTag["no-website"]).toBe(1);
    // The un-enriched one must be visible, not silently dropped.
    expect(stats.byTag.unclassified).toBe(1);
    expect(stats.byStatus.discovered).toBe(2);
    expect(stats.topCities[0]).toEqual({ city: "Ahmedabad", count: 2 });
  });

  it("ignores malformed ids in bulk actions instead of failing the batch", async () => {
    const { upsertDiscoveredProspects, setProspectStatus } =
      await import("@/lib/server/prospecting/repository");

    const { insertedIds } = await upsertDiscoveredProspects("s1", [
      normalized({ sourceId: "node/1" }),
    ]);

    const changed = await setProspectStatus(
      [insertedIds[0]!, "not-an-object-id", ""],
      "qualified",
    );
    expect(changed).toBe(1);
  });

  it("handles an empty batch without touching the database", async () => {
    const { upsertDiscoveredProspects } =
      await import("@/lib/server/prospecting/repository");

    expect(await upsertDiscoveredProspects("s1", [])).toEqual({
      insertedIds: [],
      changedWebsiteIds: [],
      inserted: 0,
      updated: 0,
    });
  });

  it("tracks a search through its lifecycle", async () => {
    const {
      createProspectSearch,
      updateProspectSearch,
      getProspectSearch,
      listProspectSearches,
    } = await import("@/lib/server/prospecting/repository");

    await createProspectSearch({
      searchId: "search-1",
      label: "Navrangpura, Ahmedabad",
      lat: 23.0225,
      lng: 72.5714,
      radiusMeters: 1_500,
      categories: ["food-drink"],
      provider: "osm",
      status: "queued",
      discovered: 0,
      added: 0,
      skipped: 0,
      error: null,
      createdById: "user-1",
    });

    expect((await getProspectSearch("search-1"))?.status).toBe("queued");

    await updateProspectSearch("search-1", {
      status: "completed",
      discovered: 42,
      added: 40,
      skipped: 2,
      completedAt: new Date(),
    });

    const done = await getProspectSearch("search-1");
    expect(done?.status).toBe("completed");
    expect(done?.added).toBe(40);
    expect(await listProspectSearches()).toHaveLength(1);
  });
});
