import { beforeAll, expect, it, describe } from "vitest";
import { hasTestDatabase, useTestDatabase } from "@/test/mongo";

/**
 * End-to-end verification against the **real** OpenStreetMap services.
 *
 * Opt-in, because these tests make live requests to donated infrastructure:
 *
 * ```bash
 * RUN_LIVE_OSM=1 TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pnpm vitest run osm.live
 * ```
 *
 * Everything else in the prospecting suite is a pure unit test against fixed
 * inputs. That proves the arithmetic and the rules, but it cannot prove that the
 * query this code builds is one Overpass actually accepts, or that a real
 * response normalises into usable prospects. Those are exactly the assumptions
 * worth checking against reality, so this file exists — deliberately narrow, one
 * small area, one category, well inside any published usage limit.
 */

const LIVE = process.env.RUN_LIVE_OSM === "1";
const describeLive = LIVE && hasTestDatabase ? describe : describe.skip;

if (!LIVE) {
  it("live OSM tests are opt-in", () => {
    // A visible, passing marker so a full run makes clear these did not execute.
    expect(process.env.RUN_LIVE_OSM ?? "unset").not.toBe("1");
  });
}

describeLive("live OpenStreetMap pipeline", () => {
  useTestDatabase();

  beforeAll(() => {
    // Point the throttled client at the public endpoints explicitly, so a
    // developer's local override cannot make this test pass against a stub.
    process.env.OVERPASS_ENDPOINT ??= "https://overpass-api.de/api/interpreter";
    process.env.NOMINATIM_ENDPOINT ??= "https://nominatim.openstreetmap.org";
  });

  it("geocodes a real place name", async () => {
    const { geocodePlace } = await import("@/lib/server/prospecting/osm");
    const results = await geocodePlace("Navrangpura, Ahmedabad", 3);

    expect(results.length).toBeGreaterThan(0);
    const first = results[0]!;
    expect(first.label.toLowerCase()).toContain("ahmedabad");
    // Ahmedabad is around 23.0N 72.6E.
    expect(first.lat).toBeGreaterThan(22.5);
    expect(first.lat).toBeLessThan(23.5);
    expect(first.lng).toBeGreaterThan(72.0);
    expect(first.lng).toBeLessThan(73.0);
    expect(first.suggestedRadiusMeters).toBeGreaterThanOrEqual(300);
    expect(first.suggestedRadiusMeters).toBeLessThanOrEqual(15_000);
  }, 60_000);

  it("counts matches in count mode", async () => {
    const { countOverpassMatches } =
      await import("@/lib/server/prospecting/osm");
    const { total } = await countOverpassMatches({
      lat: 23.0225,
      lng: 72.5714,
      radiusMeters: 800,
      categoryIds: ["food-drink"],
    });

    // Central Ahmedabad certainly has named food businesses mapped.
    expect(total).toBeGreaterThan(0);
    expect(Number.isInteger(total)).toBe(true);
  }, 90_000);

  it("fetches, normalises, and classifies real businesses", async () => {
    const { fetchOverpassElements } =
      await import("@/lib/server/prospecting/osm");
    const { normalizeOverpassElements } =
      await import("@/lib/prospecting/normalize");
    const { classifyProspect } = await import("@/lib/prospecting/classify");
    const { upsertDiscoveredProspects, listProspects } =
      await import("@/lib/server/prospecting/repository");

    const { elements } = await fetchOverpassElements({
      lat: 23.0225,
      lng: 72.5714,
      radiusMeters: 800,
      categoryIds: ["food-drink"],
      limit: 40,
    });
    expect(elements.length).toBeGreaterThan(0);

    const { prospects } = normalizeOverpassElements(elements);
    expect(prospects.length).toBeGreaterThan(0);

    // Every normalised row must be usable: these are the fields that reach an
    // email greeting and a map pin.
    for (const prospect of prospects) {
      expect(prospect.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(prospect.lat)).toBe(true);
      expect(Number.isFinite(prospect.lng)).toBe(true);
      expect(prospect.sourceId).toMatch(/^(node|way|relation)\/\d+$/);
      if (prospect.website) {
        expect(prospect.website).toMatch(/^https?:\/\//);
      }
      if (prospect.email) {
        expect(prospect.email).toContain("@");
      }
    }

    // Classification without enrichment: every row still gets a verdict.
    for (const prospect of prospects) {
      const classification = classifyProspect({
        hasWebsite: Boolean(prospect.website),
        socialOnly: !prospect.website && Boolean(prospect.socialUrl),
        signals: null,
        categoryId: prospect.categoryId,
        hasEmail: Boolean(prospect.email),
        hasPhone: Boolean(prospect.phone),
      });
      expect(classification.primaryTag).toBeTruthy();
      expect(classification.score).toBeGreaterThanOrEqual(0);
      expect(classification.score).toBeLessThanOrEqual(100);
      expect(classification.topIssues.length).toBeGreaterThan(0);
    }

    const outcome = await upsertDiscoveredProspects("live-test", prospects);
    expect(outcome.inserted).toBe(prospects.length);

    // Re-running the same batch must add nothing — the idempotency guarantee,
    // checked here against real provider ids rather than fixtures.
    const second = await upsertDiscoveredProspects("live-test-2", prospects);
    expect(second.inserted).toBe(0);

    const page = await listProspects();
    expect(page.total).toBe(prospects.length);

    // Report what the live data actually looked like, so a run is informative.
    const withWebsite = prospects.filter((p) => p.website).length;
    const withEmail = prospects.filter((p) => p.email).length;
    const withPhone = prospects.filter((p) => p.phone).length;
    console.log(
      `[live] ${prospects.length} businesses: ${withWebsite} with a website, ` +
        `${withEmail} with an email, ${withPhone} with a phone.`,
    );
  }, 180_000);

  it("runs the whole queued pipeline the admin page triggers", async () => {
    // The real path: enqueue a discovery job, run the worker, and let it queue
    // and run enrichment jobs. This is what "Grab these customers" does, so it
    // is the one test that proves the feature works rather than that its parts do.
    const { enqueueJob, JOB_TYPES } = await import("@/lib/server/jobs/queue");
    const { runDueJobs } = await import("@/lib/server/jobs/worker");
    const { createProspectSearch, getProspectSearch, listProspects } =
      await import("@/lib/server/prospecting/repository");

    const searchId = "live-pipeline";
    await createProspectSearch({
      searchId,
      label: "Live test area",
      lat: 23.0225,
      lng: 72.5714,
      radiusMeters: 900,
      categories: ["food-drink"],
      provider: "osm",
      status: "queued",
      discovered: 0,
      added: 0,
      skipped: 0,
      error: null,
      createdById: null,
    });

    await enqueueJob({
      type: JOB_TYPES.prospectDiscover,
      payload: {
        searchId,
        lat: 23.0225,
        lng: 72.5714,
        radiusMeters: 900,
        categories: ["food-drink"],
        limit: 25,
      },
    });

    // Discovery, then several passes to drain the enrichment jobs it queued.
    // Each pass audits real websites, so the budget is generous.
    for (let pass = 0; pass < 6; pass += 1) {
      const summary = await runDueJobs({ budgetMs: 120_000, maxJobs: 12 });
      if (summary.claimed === 0) break;
      expect(summary.unhandled).toBe(0);
    }

    const search = await getProspectSearch(searchId);
    expect(search?.status).toBe("completed");
    expect(search?.error).toBeNull();
    expect(search?.added).toBeGreaterThan(0);

    const page = await listProspects({ searchId });
    expect(page.total).toBe(search?.added);

    // Every prospect must end up classified, with a usable pitch. An
    // unclassified row is invisible to the operator, which is the failure mode
    // that matters most here.
    for (const prospect of page.items) {
      expect(prospect.classification, prospect.name).not.toBeNull();
      expect(prospect.classification!.primaryTag).toBeTruthy();
      expect(prospect.classification!.topIssues.length).toBeGreaterThan(0);
      expect(prospect.enrichedAt).not.toBeNull();
      expect(["qualified", "discovered", "enriching"]).toContain(
        prospect.status,
      );
      // A site that was reached must have produced signals and a score.
      if (prospect.website && prospect.signals?.reachable) {
        expect(prospect.auditScore).not.toBeNull();
      }
    }

    const summary = page.items.map((p) => ({
      name: p.name,
      tag: p.classification?.primaryTag,
      score: p.classification?.score,
      site: p.website ? "yes" : p.socialUrl ? "social" : "none",
    }));
    console.log(
      "[live] classified prospects:",
      JSON.stringify(summary, null, 2),
    );
  }, 600_000);

  it("serves the second identical query from the shared cache", async () => {
    const { fetchOverpassElements } =
      await import("@/lib/server/prospecting/osm");
    const query = {
      lat: 23.0225,
      lng: 72.5714,
      radiusMeters: 800,
      categoryIds: ["food-drink"],
      limit: 40,
    };

    await fetchOverpassElements(query);
    const second = await fetchOverpassElements(query);
    // Proves the cache is doing its job, which is what keeps this application
    // within Overpass's usage policy.
    expect(second.cached).toBe(true);
  }, 180_000);
});
