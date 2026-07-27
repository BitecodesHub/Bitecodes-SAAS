"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertCapability, getCurrentAdminUser } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { enqueueJob, JOB_TYPES } from "@/lib/server/jobs/queue";
import { kickJobs } from "@/lib/server/jobs/worker";
import { normalizeCategoryIds } from "@/lib/prospecting/categories";
import {
  clampRadius,
  RADIUS_LIMITS,
  RESULT_LIMITS,
} from "@/lib/prospecting/overpass-query";
import { createSignedToken, TOKEN_TTL } from "@/lib/server/tokens";
import { getSiteUrl } from "@/lib/server/env";
import {
  countOverpassMatches,
  geocodePlace,
  ProviderError,
  reverseGeocode,
  type GeocodeResult,
} from "@/lib/server/prospecting/osm";
import {
  addProspectNote,
  addProspectTags,
  countSearchEnrichment,
  createProspectSearch,
  deleteProspects,
  getProspect,
  getProspectSearch,
  removeProspectTag,
  setProspectEmail,
  setProspectReportShareId,
  setProspectStatus,
} from "@/lib/server/prospecting/repository";
import type { ProspectStatus } from "@/lib/server/db/types";

/**
 * Server Actions for prospect discovery and management.
 *
 * Server Actions rather than route handlers, for the same reason as
 * authentication: Next checks the request Origin against the Host on every
 * invocation, so CSRF protection comes for free.
 *
 * Every action re-authorises through `assertCapability`. An action is a public
 * endpoint — the fact that its button is hidden from a viewer-role account in
 * the UI is presentation, not protection.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Turns a provider failure into something an operator can act on. */
function describeProviderError(error: unknown): string {
  if (error instanceof ProviderError) return error.message;
  if (error instanceof Error && error.message.includes("category")) {
    return error.message;
  }
  return "The mapping service could not be reached. Please try again shortly.";
}

// ---------------------------------------------------------------------------
// Place search
// ---------------------------------------------------------------------------

const searchPlaceSchema = z.object({
  query: z.string().trim().min(2).max(200),
});

export async function searchPlaceAction(
  query: string,
): Promise<ActionResult<GeocodeResult[]>> {
  await assertCapability("manage_prospects");

  const parsed = searchPlaceSchema.safeParse({ query });
  if (!parsed.success) {
    return failure("Enter at least two characters to search for a place.");
  }

  try {
    return { ok: true, data: await geocodePlace(parsed.data.query) };
  } catch (error) {
    return failure(describeProviderError(error));
  }
}

const reverseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function describeAreaAction(
  lat: number,
  lng: number,
): Promise<ActionResult<{ label: string; city: string | null }>> {
  await assertCapability("manage_prospects");

  const parsed = reverseSchema.safeParse({ lat, lng });
  if (!parsed.success) return failure("That location is not valid.");

  const place = await reverseGeocode(parsed.data.lat, parsed.data.lng);
  return {
    ok: true,
    data: {
      label: place?.label ?? "Selected area",
      city: place?.city ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Preview and run
// ---------------------------------------------------------------------------

const areaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(RADIUS_LIMITS.min).max(RADIUS_LIMITS.max),
  categories: z.array(z.string().max(60)).min(1).max(20),
});

/**
 * Counts matches without downloading them.
 *
 * The map's live "≈N businesses" readout. Uses Overpass's count mode, which is
 * dramatically cheaper on a donated server than fetching a result set only to
 * measure its length.
 */
export async function previewAreaAction(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
}): Promise<ActionResult<{ total: number; cached: boolean }>> {
  await assertCapability("manage_prospects");

  const parsed = areaSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Choose an area and at least one business category.");
  }

  const categories = normalizeCategoryIds(parsed.data.categories);
  if (categories.length === 0) {
    return failure("Choose at least one business category.");
  }

  try {
    const result = await countOverpassMatches({
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusMeters: clampRadius(parsed.data.radiusMeters),
      categoryIds: categories,
    });
    return { ok: true, data: result };
  } catch (error) {
    return failure(describeProviderError(error));
  }
}

const runSchema = areaSchema.extend({
  label: z.string().trim().max(200).optional(),
  limit: z.number().min(RESULT_LIMITS.min).max(RESULT_LIMITS.max).optional(),
});

/**
 * Starts a discovery run.
 *
 * Returns as soon as the job is queued rather than waiting for Overpass. A
 * query over a busy area can take most of a minute, and an action that blocked
 * for that long would hit the platform's request timeout and leave the operator
 * with no idea whether the work started.
 */
export async function startDiscoveryAction(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  label?: string;
  limit?: number;
}): Promise<ActionResult<{ searchId: string }>> {
  const session = await assertCapability("manage_prospects");

  const parsed = runSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Choose an area and at least one business category.");
  }

  const categories = normalizeCategoryIds(parsed.data.categories);
  if (categories.length === 0) {
    return failure("Choose at least one business category.");
  }

  const radiusMeters = clampRadius(parsed.data.radiusMeters);
  const searchId = randomUUID();
  const label =
    parsed.data.label?.trim() ||
    `${parsed.data.lat.toFixed(3)}, ${parsed.data.lng.toFixed(3)}`;

  try {
    await createProspectSearch({
      searchId,
      label,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusMeters,
      categories,
      provider: "osm",
      status: "queued",
      discovered: 0,
      added: 0,
      skipped: 0,
      error: null,
      createdById: session.userId,
    });

    await enqueueJob({
      type: JOB_TYPES.prospectDiscover,
      payload: {
        searchId,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        radiusMeters,
        categories,
        limit: parsed.data.limit ?? RESULT_LIMITS.default,
      },
      idempotencyKey: `discover:${searchId}`,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.prospectDiscoveryStarted,
      actorId: session.userId,
      target: { type: "prospect_search", id: searchId },
      detail: { label, radiusMeters, categories },
    });

    // Start the work now rather than waiting for the next cron tick, so local
    // development and single-instance hosting need no scheduler at all. The cron
    // run remains the guaranteed path if this nudge fails.
    after(() => kickJobs(20_000));

    return { ok: true, data: { searchId } };
  } catch (error) {
    return failure(
      error instanceof Error
        ? `Could not start discovery: ${error.message}`
        : "Could not start discovery.",
    );
  }
}

export interface DiscoveryProgress {
  status: "queued" | "running" | "completed" | "failed";
  discovered: number;
  added: number;
  skipped: number;
  error: string | null;
  label: string;
  /** How many of this search's prospects still lack a classification. */
  pendingEnrichment: number;
  classified: number;
}

/**
 * Polled by the discovery console while a run is in flight.
 *
 * Read-only and cheap by design — it is called on an interval, so it counts
 * documents rather than loading them.
 */
export async function getDiscoveryProgressAction(
  searchId: string,
): Promise<ActionResult<DiscoveryProgress>> {
  await assertCapability("manage_prospects");

  const search = await getProspectSearch(searchId);
  if (!search) return failure("That discovery run no longer exists.");

  const { pending, classified } = await countSearchEnrichment(searchId);

  return {
    ok: true,
    data: {
      status: search.status,
      discovered: search.discovered,
      added: search.added,
      skipped: search.skipped,
      error: search.error,
      label: search.label,
      pendingEnrichment: pending,
      classified,
    },
  };
}

/** Re-runs enrichment for specific prospects, on demand. */
export async function enrichProspectsAction(
  ids: string[],
): Promise<ActionResult<{ queued: number }>> {
  await assertCapability("manage_prospects");

  const unique = [...new Set(ids.filter((id) => id.length === 24))].slice(
    0,
    200,
  );
  if (unique.length === 0) return failure("Select at least one customer.");

  await Promise.all(
    unique.map((prospectId) =>
      enqueueJob({
        type: JOB_TYPES.prospectEnrich,
        payload: { prospectId },
        idempotencyKey: `enrich:${prospectId}`,
      }),
    ),
  );

  after(() => kickJobs(20_000));
  revalidatePath("/admin/customers");
  return { ok: true, data: { queued: unique.length } };
}

// ---------------------------------------------------------------------------
// Personalised report link
// ---------------------------------------------------------------------------

/**
 * Mints the signed link to a prospect's report.
 *
 * The token carries the prospect id and expires; the URL therefore cannot be
 * enumerated, and a forwarded link stops working. The id is also recorded on the
 * prospect so the admin panel can show the same link twice rather than issuing a
 * new one on every visit.
 */
export async function createReportLinkAction(
  prospectId: string,
): Promise<ActionResult<{ url: string }>> {
  await assertCapability("manage_prospects");

  const prospect = await getProspect(prospectId);
  if (!prospect) return failure("That customer no longer exists.");
  if (!prospect.classification) {
    return failure(
      "This customer has not been checked yet, so there is nothing to report. Re-check the website first.",
    );
  }

  let token: string;
  try {
    token = createSignedToken({
      purpose: "report",
      data: { id: prospectId },
      ttlSeconds: TOKEN_TTL.report,
    });
  } catch {
    // Thrown when AUTH_SECRET is absent; signing must never fall back.
    return failure(
      "Report links need AUTH_SECRET to be configured before they can be signed.",
    );
  }

  // A short, stable handle for the admin UI. The token itself is the credential.
  if (!prospect.reportShareId) {
    await setProspectReportShareId(prospectId, randomUUID().slice(0, 12));
  }

  return { ok: true, data: { url: `${getSiteUrl()}/report/${token}` } };
}

// ---------------------------------------------------------------------------
// Pipeline management
// ---------------------------------------------------------------------------

const STATUSES: ProspectStatus[] = [
  "discovered",
  "enriching",
  "qualified",
  "queued",
  "contacted",
  "replied",
  "meeting",
  "won",
  "lost",
  "suppressed",
];

export async function setProspectStatusAction(
  ids: string[],
  status: string,
): Promise<ActionResult<{ changed: number }>> {
  const session = await assertCapability("manage_prospects");

  if (!STATUSES.includes(status as ProspectStatus)) {
    return failure("That is not a valid pipeline stage.");
  }
  if (ids.length === 0) return failure("Select at least one customer.");

  const changed = await setProspectStatus(ids, status as ProspectStatus);

  await recordAudit({
    action: AUDIT_ACTIONS.prospectStatusChanged,
    actorId: session.userId,
    detail: { status, count: changed },
  });

  revalidatePath("/admin/customers");
  return { ok: true, data: { changed } };
}

export async function tagProspectsAction(
  ids: string[],
  tags: string[],
): Promise<ActionResult<{ changed: number }>> {
  const session = await assertCapability("manage_prospects");

  if (ids.length === 0) return failure("Select at least one customer.");
  const changed = await addProspectTags(ids, tags);

  await recordAudit({
    action: AUDIT_ACTIONS.prospectsTagged,
    actorId: session.userId,
    detail: { tags, count: changed },
  });

  revalidatePath("/admin/customers");
  return { ok: true, data: { changed } };
}

export async function untagProspectsAction(
  ids: string[],
  tag: string,
): Promise<ActionResult<{ changed: number }>> {
  await assertCapability("manage_prospects");
  if (ids.length === 0) return failure("Select at least one customer.");

  const changed = await removeProspectTag(ids, tag);
  revalidatePath("/admin/customers");
  return { ok: true, data: { changed } };
}

const emailSchema = z.union([
  z.string().trim().toLowerCase().email().max(254),
  z.literal(""),
]);

export async function setProspectEmailAction(
  id: string,
  email: string,
): Promise<ActionResult> {
  await assertCapability("manage_prospects");

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return failure("Enter a valid email address.");

  const updated = await setProspectEmail(id, parsed.data || null);
  if (!updated) return failure("That customer no longer exists.");

  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
  return { ok: true };
}

const noteSchema = z.object({ body: z.string().trim().min(1).max(4_000) });

export async function addProspectNoteAction(
  id: string,
  body: string,
): Promise<ActionResult> {
  const session = await assertCapability("manage_prospects");

  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) return failure("Write a note before saving.");

  const user = await getCurrentAdminUser();
  const added = await addProspectNote(id, {
    authorId: session.userId,
    authorName: user?.name ?? user?.email ?? "Admin",
    body: parsed.data.body,
  });
  if (!added) return failure("That customer no longer exists.");

  revalidatePath(`/admin/customers/${id}`);
  return { ok: true };
}

/**
 * Deletes prospects outright.
 *
 * Requires `manage_settings` rather than `manage_prospects`: everything else in
 * this file is reversible, and deletion is the one action that discards
 * classification work and contact history for good.
 */
export async function deleteProspectsAction(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  const session = await assertCapability("manage_settings");
  if (ids.length === 0) return failure("Select at least one customer.");

  const deleted = await deleteProspects(ids);

  await recordAudit({
    action: AUDIT_ACTIONS.prospectStatusChanged,
    actorId: session.userId,
    detail: { deleted, action: "delete" },
  });

  revalidatePath("/admin/customers");
  return { ok: true, data: { deleted } };
}
