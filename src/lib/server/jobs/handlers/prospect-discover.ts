import "server-only";

import { z } from "zod";
import { normalizeOverpassElements } from "@/lib/prospecting/normalize";
import { normalizeCategoryIds } from "@/lib/prospecting/categories";
import {
  clampLimit,
  clampRadius,
  RESULT_LIMITS,
} from "@/lib/prospecting/overpass-query";
import {
  fetchOverpassElements,
  ProviderError,
} from "@/lib/server/prospecting/osm";
import {
  updateProspectSearch,
  upsertDiscoveredProspects,
} from "@/lib/server/prospecting/repository";
import { enqueueJob, JOB_TYPES } from "@/lib/server/jobs/queue";
import type { JobContext } from "@/lib/server/jobs/worker";
import { getSettingsFresh } from "@/lib/server/settings";

/**
 * Runs one map-area discovery.
 *
 * Kept in a job rather than in the request that starts it because an Overpass
 * query can take the better part of a minute, and a discovery that dies with the
 * browser tab would be worse than useless — it would leave the search record
 * stuck at `running` forever. The job records its own outcome on the search
 * document either way, which is what the admin page polls.
 */

const payloadSchema = z.object({
  searchId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number(),
  categories: z.array(z.string()).min(1),
  limit: z.number().optional(),
});

export async function handleProspectDiscover(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    // A malformed payload cannot be fixed by retrying. Throwing lets the queue
    // exhaust its attempts, but the search record must not be left `running`.
    throw new Error(
      `Invalid discovery payload: ${Object.keys(parsed.error.flatten().fieldErrors).join(", ")}`,
    );
  }

  const { searchId, lat, lng } = parsed.data;
  const categories = normalizeCategoryIds(parsed.data.categories);
  if (categories.length === 0) {
    await updateProspectSearch(searchId, {
      status: "failed",
      error: "No recognised categories were selected.",
      completedAt: new Date(),
    });
    throw new Error("No recognised categories were selected.");
  }

  const radiusMeters = clampRadius(parsed.data.radiusMeters);
  const limit = clampLimit(parsed.data.limit ?? RESULT_LIMITS.default);

  await updateProspectSearch(searchId, { status: "running", error: null });

  try {
    const { elements, cached, remark } = await fetchOverpassElements({
      lat,
      lng,
      radiusMeters,
      categoryIds: categories,
      limit,
    });
    context.log(
      `Overpass returned ${elements.length} elements${cached ? " (cached)" : ""}.`,
    );
    if (remark) context.log(`Provider remark: ${remark.slice(0, 200)}`);

    const { prospects: normalized, skipped } =
      normalizeOverpassElements(elements);
    context.log(
      `${normalized.length} usable businesses, ${skipped} rows discarded.`,
    );

    const outcome = await upsertDiscoveredProspects(
      searchId,
      normalized,
      "osm",
    );
    context.log(
      `${outcome.inserted} added, ${outcome.updated} refreshed, ${outcome.changedWebsiteIds.length} need re-checking.`,
    );

    await updateProspectSearch(searchId, {
      status: "completed",
      discovered: elements.length,
      added: outcome.inserted,
      skipped: skipped + outcome.updated,
      error: null,
      completedAt: new Date(),
    });

    // Enrichment is a separate job per prospect: one slow or hostile website
    // must not fail the whole discovery, and per-prospect retries are what make
    // the pipeline eventually consistent rather than all-or-nothing.
    // Read fresh rather than cached: an operator who has just switched
    // enrichment off expects the next run to honour that, not a stale copy.
    const { automation } = await getSettingsFresh();
    const autoEnrich = automation.autoEnrich;
    const toEnrich = [...outcome.insertedIds, ...outcome.changedWebsiteIds];

    if (autoEnrich && toEnrich.length > 0) {
      await Promise.all(
        toEnrich.map((prospectId) =>
          enqueueJob({
            type: JOB_TYPES.prospectEnrich,
            payload: { prospectId },
            // One pending enrichment per prospect, however many times
            // discovery is re-run over the same area.
            idempotencyKey: `enrich:${prospectId}`,
          }),
        ),
      );
      context.log(`Queued ${toEnrich.length} enrichment jobs.`);
    } else if (!autoEnrich) {
      context.log("Automatic enrichment is switched off in settings.");
    }

    return {
      discovered: elements.length,
      added: outcome.inserted,
      refreshed: outcome.updated,
      skipped,
      enrichmentQueued: autoEnrich ? toEnrich.length : 0,
      cached,
    };
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Discovery failed.";

    // Record the failure on the search so the operator sees why, then rethrow so
    // the queue's own backoff decides whether to try again.
    await updateProspectSearch(searchId, {
      status: "failed",
      error: message.slice(0, 500),
      completedAt: new Date(),
    });
    throw error;
  }
}
