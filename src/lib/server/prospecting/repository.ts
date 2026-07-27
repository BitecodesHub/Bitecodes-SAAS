import "server-only";

import { ObjectId, type AnyBulkWriteOperation, type Filter } from "mongodb";
import { prospects, prospectSearches } from "@/lib/server/db/collections";
import type {
  ProspectClassification,
  ProspectDoc,
  ProspectSearchDoc,
  ProspectSignals,
  ProspectStatus,
  ProspectTag,
} from "@/lib/server/db/types";
import type { NormalizedProspect } from "@/lib/prospecting/normalize";

/**
 * Persistence for discovered prospects.
 *
 * The one rule this module exists to enforce: **a re-run of a search must never
 * destroy operator work.** Discovery is idempotent and will be run repeatedly
 * over the same area, so provider-sourced facts (name, address, phone) are
 * refreshed on every pass while anything a human touched — pipeline status,
 * assignment, notes, hand-added tags, contact history — is written only on
 * insert. Getting that backwards would silently reset a half-worked pipeline,
 * and the operator would have no way to notice.
 */

/** Fields the provider owns and may refresh on every discovery pass. */
type ProviderFields = Pick<
  ProspectDoc,
  | "name"
  | "category"
  | "categoryLabel"
  | "phone"
  | "website"
  | "socialUrl"
  | "address"
  | "city"
  | "region"
  | "postcode"
  | "countryCode"
  | "lat"
  | "lng"
  | "dedupeKey"
>;

export interface UpsertOutcome {
  /** Prospects that did not exist before this run. */
  insertedIds: string[];
  /** Existing prospects whose website appeared or changed. */
  changedWebsiteIds: string[];
  inserted: number;
  updated: number;
}

function providerFields(input: NormalizedProspect): ProviderFields {
  return {
    name: input.name,
    category: input.category,
    categoryLabel: input.categoryLabel,
    phone: input.phone,
    website: input.website,
    socialUrl: input.socialUrl,
    address: input.address,
    city: input.city,
    region: input.region,
    postcode: input.postcode,
    countryCode: input.countryCode,
    lat: input.lat,
    lng: input.lng,
    dedupeKey: input.dedupeKey,
  };
}

/**
 * Writes a batch of discovered businesses.
 *
 * Existing documents are read first so each update can be decided individually:
 * a blanket `$set` would overwrite a hand-entered email with the provider's
 * `null`, and a blanket `$setOnInsert` would never pick up a website the
 * business has since published. Two round trips buy correctness on both.
 *
 * Returns which records are new and which gained a website, because those are
 * exactly the ones that need (re-)enrichment.
 */
export async function upsertDiscoveredProspects(
  searchId: string | null,
  incoming: readonly NormalizedProspect[],
  source: ProspectDoc["source"] = "osm",
  now = new Date(),
): Promise<UpsertOutcome> {
  if (incoming.length === 0) {
    return { insertedIds: [], changedWebsiteIds: [], inserted: 0, updated: 0 };
  }

  const collection = await prospects();
  const sourceIds = incoming.map((entry) => entry.sourceId);
  const existing = await collection
    .find(
      { source, sourceId: { $in: sourceIds } },
      { projection: { sourceId: 1, website: 1, email: 1, socialUrl: 1 } },
    )
    .toArray();

  const existingBySourceId = new Map(
    existing.map((document) => [document.sourceId, document]),
  );

  const operations: AnyBulkWriteOperation<ProspectDoc>[] = [];
  const changedWebsiteIds: string[] = [];

  for (const entry of incoming) {
    const previous = existingBySourceId.get(entry.sourceId);

    if (!previous) {
      operations.push({
        insertOne: {
          document: {
            source,
            sourceId: entry.sourceId,
            ...providerFields(entry),
            email: entry.email,
            emailSource: entry.email ? "provider" : null,
            websiteFinalUrl: null,
            searchId,
            status: "discovered",
            classification: null,
            signals: null,
            auditReportId: null,
            auditScore: null,
            reportShareId: null,
            tags: [],
            notes: [],
            assignedToId: null,
            enrichedAt: null,
            enrichmentError: null,
            lastContactedAt: null,
            contactCount: 0,
            createdAt: now,
            updatedAt: now,
          } as ProspectDoc,
        },
      });
      continue;
    }

    const websiteChanged =
      (entry.website ?? null) !== (previous.website ?? null) &&
      entry.website !== null;
    if (websiteChanged && previous._id) {
      changedWebsiteIds.push(previous._id.toHexString());
    }

    const update: Partial<ProspectDoc> = {
      ...providerFields(entry),
      updatedAt: now,
    };

    // Only fill an email that is currently absent. A hand-entered or
    // website-harvested address is better evidence than a stale OSM tag, and
    // overwriting it would break reply threading.
    if (!previous.email && entry.email) {
      update.email = entry.email;
      update.emailSource = "provider";
    }

    // A website appearing invalidates the previous classification.
    if (websiteChanged) {
      update.websiteFinalUrl = null;
      update.signals = null;
      update.classification = null;
      update.auditScore = null;
      update.enrichedAt = null;
      update.enrichmentError = null;
    }

    operations.push({
      updateOne: {
        filter: { _id: previous._id },
        update: { $set: update },
      },
    });
  }

  // `ordered: false` so one duplicate-key collision does not abandon the rest
  // of the batch. A concurrent discovery run over an overlapping area is the
  // expected cause, and losing that race is harmless.
  const result = await collection.bulkWrite(operations, { ordered: false });

  const insertedIds = Object.values(result.insertedIds ?? {}).map((id) =>
    String(id),
  );

  return {
    insertedIds,
    changedWebsiteIds,
    inserted: insertedIds.length,
    updated: result.modifiedCount ?? 0,
  };
}

/** Records enrichment results for one prospect. */
export async function saveEnrichment(
  prospectId: string,
  update: {
    signals: ProspectSignals | null;
    /**
     * Null when the check could not be completed. Recording null is the honest
     * outcome: the prospect shows as "not checked yet" and cannot feed outreach,
     * rather than carrying an invented verdict.
     */
    classification: ProspectClassification | null;
    auditScore: number | null;
    auditReportId?: string | null;
    websiteFinalUrl?: string | null;
    email?: string | null;
    emailSource?: ProspectDoc["emailSource"];
    error?: string | null;
  },
  now = new Date(),
): Promise<boolean> {
  const collection = await prospects();

  const fields: Partial<ProspectDoc> = {
    signals: update.signals,
    classification: update.classification,
    auditScore: update.auditScore,
    enrichedAt: now,
    enrichmentError: update.error ?? null,
    updatedAt: now,
  };
  if (update.auditReportId !== undefined) {
    fields.auditReportId = update.auditReportId;
  }
  if (update.websiteFinalUrl !== undefined) {
    fields.websiteFinalUrl = update.websiteFinalUrl;
  }

  const result = await collection.updateOne(
    { _id: toObjectId(prospectId) },
    { $set: fields },
  );

  // A harvested email is written in a second, guarded update rather than in the
  // set above: it must fill an empty field, never displace an address a human
  // entered or a previous run confirmed. Expressing "only if absent" inside a
  // single `$set` is not possible, and a read-then-write would race.
  if (update.email) {
    await collection.updateOne(
      {
        _id: toObjectId(prospectId),
        $or: [{ email: null }, { email: { $exists: false } }],
      },
      {
        $set: {
          email: update.email,
          emailSource: update.emailSource ?? "website",
          updatedAt: now,
        },
      },
    );
  }

  return result.matchedCount === 1;
}

/** Marks a prospect as being enriched, so the UI can show progress. */
export async function markEnriching(
  prospectId: string,
  now = new Date(),
): Promise<void> {
  const collection = await prospects();
  await collection.updateOne(
    { _id: toObjectId(prospectId), status: "discovered" },
    { $set: { status: "enriching", updatedAt: now } },
  );
}

/**
 * Moves a prospect out of the enrichment states once classification lands.
 *
 * Only `discovered` and `enriching` are advanced: a prospect an operator has
 * already qualified, contacted, or won must not be dragged backwards by a
 * routine re-enrichment.
 */
export async function markQualified(
  prospectId: string,
  now = new Date(),
): Promise<void> {
  const collection = await prospects();
  await collection.updateOne(
    {
      _id: toObjectId(prospectId),
      status: { $in: ["discovered", "enriching"] },
    },
    { $set: { status: "qualified", updatedAt: now } },
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ProspectQuery {
  search?: string;
  status?: ProspectStatus | "all";
  tag?: ProspectTag | "all";
  city?: string;
  searchId?: string;
  /** Only prospects with a usable email, for send planning. */
  emailOnly?: boolean;
  minScore?: number;
  page?: number;
  pageSize?: number;
  sort?: "score" | "recent" | "name";
}

export const PROSPECT_PAGE_SIZE = 25;

export function buildProspectFilter(query: ProspectQuery): Filter<ProspectDoc> {
  const filter: Filter<ProspectDoc> = {};

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.tag && query.tag !== "all") {
    filter["classification.primaryTag"] = query.tag;
  }
  if (query.city) filter.city = query.city;
  if (query.searchId) filter.searchId = query.searchId;
  if (query.emailOnly) filter.email = { $type: "string", $ne: "" };
  if (typeof query.minScore === "number" && query.minScore > 0) {
    filter["classification.score"] = { $gte: query.minScore };
  }

  const term = query.search?.trim();
  if (term) {
    // Escaped so an operator typing "c++" or "(" cannot produce an invalid
    // expression or an accidental catch-all.
    const pattern = new RegExp(escapeRegExp(term), "i");
    filter.$or = [
      { name: pattern },
      { city: pattern },
      { email: pattern },
      { website: pattern },
      { address: pattern },
    ];
  }

  return filter;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProspectPage {
  items: ProspectDoc[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listProspects(
  query: ProspectQuery = {},
): Promise<ProspectPage> {
  const collection = await prospects();
  const filter = buildProspectFilter(query);

  const pageSize = Math.min(
    100,
    Math.max(1, Math.round(query.pageSize ?? PROSPECT_PAGE_SIZE)),
  );
  const requestedPage = Math.max(1, Math.round(query.page ?? 1));

  const total = await collection.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Clamp rather than return an empty page: narrowing a filter while on page 5
  // should show results, not a blank table.
  const page = Math.min(requestedPage, totalPages);

  const items = await collection
    .find(filter)
    .sort(sortSpec(query.sort))
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return { items, total, page, pageSize, totalPages };
}

function sortSpec(sort: ProspectQuery["sort"]): Record<string, 1 | -1> {
  switch (sort) {
    case "recent":
      return { updatedAt: -1 };
    case "name":
      return { name: 1 };
    default:
      // Highest opportunity first, then most recent, so the queue drains in
      // value order and ties are stable.
      return { "classification.score": -1, updatedAt: -1 };
  }
}

export async function getProspect(id: string): Promise<ProspectDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await prospects();
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function getProspectByReportShareId(
  shareId: string,
): Promise<ProspectDoc | null> {
  const collection = await prospects();
  return collection.findOne({ reportShareId: shareId });
}

/** Counts per primary tag and per status, for filter chips and the dashboard. */
export async function getProspectStats(): Promise<{
  total: number;
  withEmail: number;
  byTag: Record<string, number>;
  byStatus: Record<string, number>;
  topCities: Array<{ city: string; count: number }>;
}> {
  const collection = await prospects();

  const [total, withEmail, byTag, byStatus, topCities] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ email: { $type: "string", $ne: "" } }),
    collection
      .aggregate<{
        _id: string | null;
        count: number;
      }>([
        { $group: { _id: "$classification.primaryTag", count: { $sum: 1 } } },
      ])
      .toArray(),
    collection
      .aggregate<{
        _id: string;
        count: number;
      }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray(),
    collection
      .aggregate<{
        _id: string | null;
        count: number;
      }>([
        { $match: { city: { $type: "string" } } },
        { $group: { _id: "$city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ])
      .toArray(),
  ]);

  return {
    total,
    withEmail,
    byTag: toCountMap(byTag, "unclassified"),
    byStatus: toCountMap(byStatus, "unknown"),
    topCities: topCities.flatMap((row) =>
      row._id ? [{ city: row._id, count: row.count }] : [],
    ),
  };
}

function toCountMap(
  rows: Array<{ _id: string | null; count: number }>,
  nullLabel: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) result[row._id ?? nullLabel] = row.count;
  return result;
}

/** Every distinct city, for the filter dropdown. */
export async function listProspectCities(): Promise<string[]> {
  const collection = await prospects();
  const values = await collection.distinct("city", {
    city: { $type: "string" },
  });
  return values.filter((value): value is string => Boolean(value)).sort();
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function setProspectStatus(
  ids: readonly string[],
  status: ProspectStatus,
  now = new Date(),
): Promise<number> {
  const objectIds = toObjectIds(ids);
  if (objectIds.length === 0) return 0;

  const collection = await prospects();
  const result = await collection.updateMany(
    { _id: { $in: objectIds } },
    { $set: { status, updatedAt: now } },
  );
  return result.modifiedCount;
}

export async function addProspectTags(
  ids: readonly string[],
  tags: readonly string[],
  now = new Date(),
): Promise<number> {
  const objectIds = toObjectIds(ids);
  const cleaned = [
    ...new Set(
      tags
        .map((tag) => tag.trim().slice(0, 40))
        .filter((tag) => tag.length > 0),
    ),
  ];
  if (objectIds.length === 0 || cleaned.length === 0) return 0;

  const collection = await prospects();
  const result = await collection.updateMany(
    { _id: { $in: objectIds } },
    {
      $addToSet: { tags: { $each: cleaned } },
      $set: { updatedAt: now },
    },
  );
  return result.modifiedCount;
}

export async function removeProspectTag(
  ids: readonly string[],
  tag: string,
  now = new Date(),
): Promise<number> {
  const objectIds = toObjectIds(ids);
  if (objectIds.length === 0) return 0;

  const collection = await prospects();
  const result = await collection.updateMany(
    { _id: { $in: objectIds } },
    { $pull: { tags: tag }, $set: { updatedAt: now } },
  );
  return result.modifiedCount;
}

export async function setProspectEmail(
  id: string,
  email: string | null,
  now = new Date(),
): Promise<boolean> {
  const collection = await prospects();
  const result = await collection.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        email,
        emailSource: email ? "manual" : null,
        updatedAt: now,
      },
    },
  );
  return result.matchedCount === 1;
}

export async function setProspectReportShareId(
  id: string,
  shareId: string,
  now = new Date(),
): Promise<boolean> {
  const collection = await prospects();
  const result = await collection.updateOne(
    { _id: toObjectId(id) },
    { $set: { reportShareId: shareId, updatedAt: now } },
  );
  return result.matchedCount === 1;
}

export async function recordProspectContacted(
  id: string,
  now = new Date(),
): Promise<void> {
  const collection = await prospects();
  await collection.updateOne(
    { _id: toObjectId(id) },
    {
      $set: { lastContactedAt: now, updatedAt: now },
      $inc: { contactCount: 1 },
    },
  );

  // Advancing the pipeline is a separate, filtered update so a later stage is
  // never dragged backwards: a prospect who already replied stays `replied`
  // when a follow-up goes out.
  await collection.updateOne(
    {
      _id: toObjectId(id),
      status: { $in: ["discovered", "enriching", "qualified", "queued"] },
    },
    { $set: { status: "contacted" } },
  );
}

export async function addProspectNote(
  id: string,
  note: { authorId: string | null; authorName: string; body: string },
  now = new Date(),
): Promise<boolean> {
  const collection = await prospects();
  const result = await collection.updateOne(
    { _id: toObjectId(id) },
    {
      $push: {
        notes: {
          id: new ObjectId().toHexString(),
          authorId: note.authorId,
          authorName: note.authorName.slice(0, 120),
          body: note.body.trim().slice(0, 4_000),
          createdAt: now,
        },
      },
      $set: { updatedAt: now },
    },
  );
  return result.matchedCount === 1;
}

export async function deleteProspects(ids: readonly string[]): Promise<number> {
  const objectIds = toObjectIds(ids);
  if (objectIds.length === 0) return 0;
  const collection = await prospects();
  const result = await collection.deleteMany({ _id: { $in: objectIds } });
  return result.deletedCount;
}

// ---------------------------------------------------------------------------
// Searches
// ---------------------------------------------------------------------------

export async function createProspectSearch(
  input: Omit<
    ProspectSearchDoc,
    "_id" | "createdAt" | "updatedAt" | "completedAt"
  >,
  now = new Date(),
): Promise<string> {
  const collection = await prospectSearches();
  await collection.insertOne({
    ...input,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  } as ProspectSearchDoc);
  return input.searchId;
}

export async function updateProspectSearch(
  searchId: string,
  update: Partial<
    Pick<
      ProspectSearchDoc,
      "status" | "discovered" | "added" | "skipped" | "error" | "completedAt"
    >
  >,
  now = new Date(),
): Promise<void> {
  const collection = await prospectSearches();
  await collection.updateOne(
    { searchId },
    { $set: { ...update, updatedAt: now } },
  );
}

export async function getProspectSearch(
  searchId: string,
): Promise<ProspectSearchDoc | null> {
  const collection = await prospectSearches();
  return collection.findOne({ searchId });
}

/**
 * How far enrichment has got for one search.
 *
 * Counts rather than loads: the discovery console polls this on an interval
 * while a run is in flight, so it must stay cheap even for a 500-prospect run.
 */
export async function countSearchEnrichment(
  searchId: string,
): Promise<{ pending: number; classified: number }> {
  const collection = await prospects();
  const [pending, classified] = await Promise.all([
    collection.countDocuments({ searchId, classification: null }),
    collection.countDocuments({ searchId, classification: { $ne: null } }),
  ]);
  return { pending, classified };
}

export async function listProspectSearches(
  limit = 20,
): Promise<ProspectSearchDoc[]> {
  const collection = await prospectSearches();
  return collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .toArray();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new Error(`Invalid prospect id: ${id}`);
  return new ObjectId(id);
}

/** Silently drops malformed ids so one bad checkbox cannot fail a bulk action. */
export function toObjectIds(ids: readonly string[]): ObjectId[] {
  return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
}
