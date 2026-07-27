import "server-only";

import { ObjectId, type Filter, type Document } from "mongodb";
import {
  auditReports,
  consultantRequests,
  contactEnquiries,
} from "@/lib/server/db/collections";
import { COLLECTIONS } from "@/lib/server/db/schema";
import type {
  ActivityNote,
  AuditReportDoc,
  ConsultantRequestDoc,
  ContactEnquiryDoc,
  LeadStatus,
} from "@/lib/server/db/types";
import {
  escapeRegExp,
  LEAD_PAGE_SIZE,
  type LeadKind,
  type LeadQuery,
  type LeadSummary,
} from "@/lib/leads/display";

/**
 * Re-exported so server callers have one import for the whole lead API. Client
 * components must import from `@/lib/leads/display` directly — reaching through
 * this module would pull the MongoDB driver into the browser bundle.
 */
export {
  csvEscape,
  escapeRegExp,
  LEAD_KIND_LABELS,
  LEAD_PAGE_SIZE,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  toCsv,
  type LeadKind,
  type LeadQuery,
  type LeadSummary,
} from "@/lib/leads/display";

/**
 * The unified leads inbox.
 *
 * Inbound interest arrives through three different doors — the contact form, the
 * AI consultant, and the free website audit — and lands in three collections
 * with three different shapes. An operator does not care about that distinction:
 * they want one list, newest first, with the ability to filter.
 *
 * So reads go through a single `$unionWith` aggregation that projects all three
 * into one summary shape. The alternative — three queries merged in memory —
 * cannot paginate or count correctly, because "page 2 of the union" is not
 * derivable from "page 2 of each part".
 *
 * Writes stay per-collection. Each source has genuinely different fields worth
 * keeping, and flattening them into one table would lose the consultant's quote
 * and the audit's findings, which are the most useful things about those leads.
 */

/**
 * Projection stages that flatten each collection into `LeadSummary`.
 *
 * `$ifNull` guards every optional field because the CRM columns were added
 * after the contact form shipped: documents written before then have no
 * `notes`, `tags`, or `assignedToId`, and a missing field must read as a default
 * rather than as `null` in the middle of a sort.
 */
function enquiryProjection(): Document {
  return {
    $project: {
      _id: 1,
      kind: { $literal: "enquiry" },
      reference: { $ifNull: ["$reference", "$requestId"] },
      name: "$name",
      email: "$email",
      company: "$company",
      summary: { $ifNull: ["$message", ""] },
      status: { $ifNull: ["$status", "new"] },
      budget: "$budget",
      source: { $ifNull: ["$source", "contact-form"] },
      noteCount: { $size: { $ifNull: ["$notes", []] } },
      assignedToId: { $ifNull: ["$assignedToId", null] },
      createdAt: 1,
      score: { $literal: null },
    },
  };
}

function consultantProjection(): Document {
  return {
    $project: {
      _id: 1,
      kind: { $literal: "consultant" },
      reference: { $ifNull: ["$reference", "$requestId"] },
      // The brief is a nested object; surface the fields worth showing in a row.
      name: { $ifNull: ["$input.name", null] },
      email: { $ifNull: ["$email", "$input.email"] },
      company: { $ifNull: ["$input.company", null] },
      summary: {
        $ifNull: ["$input.description", "$input.projectType", ""],
      },
      status: { $ifNull: ["$status", "new"] },
      budget: { $ifNull: ["$input.budget", null] },
      source: { $literal: "ai-consultant" },
      noteCount: { $size: { $ifNull: ["$notes", []] } },
      assignedToId: { $ifNull: ["$assignedToId", null] },
      createdAt: 1,
      score: { $literal: null },
    },
  };
}

function auditProjection(): Document {
  return {
    $project: {
      _id: 1,
      kind: { $literal: "audit" },
      reference: "$requestId",
      name: { $literal: null },
      email: "$email",
      company: { $literal: null },
      summary: { $ifNull: ["$auditedUrl", "$hostname"] },
      status: { $ifNull: ["$status", "new"] },
      budget: { $literal: null },
      source: { $ifNull: ["$source", "public-tool"] },
      noteCount: { $size: { $ifNull: ["$notes", []] } },
      assignedToId: { $ifNull: ["$assignedToId", null] },
      createdAt: 1,
      score: { $ifNull: ["$result.overallScore", null] },
    },
  };
}

/**
 * Post-union filter.
 *
 * Applied after projection rather than per-collection so one predicate covers
 * all three shapes. The cost is that it cannot use each collection's indexes;
 * that is acceptable for an inbox an operator scrolls, and the alternative is
 * three divergent filters that would drift out of step.
 */
function buildUnionFilter(query: LeadQuery): Filter<Document> {
  const filter: Filter<Document> = {};

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.kind && query.kind !== "all") filter.kind = query.kind;
  if (query.assignedToId) filter.assignedToId = query.assignedToId;

  const term = query.search?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegExp(term), "i");
    filter.$or = [
      { name: pattern },
      { email: pattern },
      { company: pattern },
      { summary: pattern },
      { reference: pattern },
    ];
  }

  return filter;
}

/** One page of the inbox, with the totals needed to render pagination. */
export interface LeadPage {
  items: LeadSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listLeads(query: LeadQuery = {}): Promise<LeadPage> {
  const enquiries = await contactEnquiries();

  const pageSize = Math.min(
    100,
    Math.max(1, Math.round(query.pageSize ?? LEAD_PAGE_SIZE)),
  );
  const requestedPage = Math.max(1, Math.round(query.page ?? 1));
  const filter = buildUnionFilter(query);

  const unionStages: Document[] = [
    enquiryProjection(),
    {
      $unionWith: {
        coll: COLLECTIONS.consultantRequests,
        pipeline: [consultantProjection()],
      },
    },
    {
      $unionWith: {
        coll: COLLECTIONS.auditReports,
        pipeline: [auditProjection()],
      },
    },
    { $match: filter },
  ];

  // One round trip for the page and the count. `$facet` keeps them consistent:
  // counting separately can disagree with the page when a lead arrives between
  // the two queries, which shows as a phantom empty final page.
  const [result] = await enquiries
    .aggregate<{
      rows: Array<Omit<LeadSummary, "id"> & { _id: ObjectId }>;
      total: Array<{ count: number }>;
    }>([
      ...unionStages,
      {
        $facet: {
          rows: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: (requestedPage - 1) * pageSize },
            { $limit: pageSize },
          ],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  const total = result?.total[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // A page past the end returns nothing from `$skip`. Re-run once at the last
  // real page rather than showing an empty table after a filter narrows.
  if (requestedPage > totalPages && total > 0) {
    return listLeads({ ...query, page: totalPages, pageSize });
  }

  return {
    items: (result?.rows ?? []).map(({ _id, ...row }) => ({
      ...row,
      id: _id.toHexString(),
    })),
    total,
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalPages,
  };
}

/** Counts per status and per kind, for the filter chips and dashboard. */
export async function getLeadStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
}> {
  const enquiries = await contactEnquiries();

  const rows = await enquiries
    .aggregate<{ _id: { status: string; kind: string }; count: number }>([
      enquiryProjection(),
      {
        $unionWith: {
          coll: COLLECTIONS.consultantRequests,
          pipeline: [consultantProjection()],
        },
      },
      {
        $unionWith: {
          coll: COLLECTIONS.auditReports,
          pipeline: [auditProjection()],
        },
      },
      {
        $group: {
          _id: { status: "$status", kind: "$kind" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    total += row.count;
    byStatus[row._id.status] = (byStatus[row._id.status] ?? 0) + row.count;
    byKind[row._id.kind] = (byKind[row._id.kind] ?? 0) + row.count;
  }

  return { total, byStatus, byKind };
}

// ---------------------------------------------------------------------------
// Single-lead reads and writes
// ---------------------------------------------------------------------------

export type LeadDetail =
  | { kind: "enquiry"; doc: ContactEnquiryDoc }
  | { kind: "consultant"; doc: ConsultantRequestDoc }
  | { kind: "audit"; doc: AuditReportDoc };

/**
 * Loads one lead.
 *
 * The kind must be supplied by the caller (it is in the URL) rather than
 * discovered by probing all three collections: an ObjectId is only unique within
 * a collection, so probing could return the wrong document.
 */
export async function getLead(
  kind: LeadKind,
  id: string,
): Promise<LeadDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const _id = new ObjectId(id);

  switch (kind) {
    case "enquiry": {
      const doc = await (await contactEnquiries()).findOne({ _id });
      return doc ? { kind, doc } : null;
    }
    case "consultant": {
      const doc = await (await consultantRequests()).findOne({ _id });
      return doc ? { kind, doc } : null;
    }
    case "audit": {
      const doc = await (await auditReports()).findOne({ _id });
      return doc ? { kind, doc } : null;
    }
    default:
      return null;
  }
}

async function collectionFor(kind: LeadKind) {
  switch (kind) {
    case "enquiry":
      return contactEnquiries();
    case "consultant":
      return consultantRequests();
    case "audit":
      return auditReports();
  }
}

export async function setLeadStatus(
  kind: LeadKind,
  ids: readonly string[],
  status: LeadStatus,
  now = new Date(),
): Promise<number> {
  const objectIds = ids
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (objectIds.length === 0) return 0;

  const collection = await collectionFor(kind);
  const result = await collection.updateMany(
    { _id: { $in: objectIds } } as Filter<Document>,
    { $set: { status, updatedAt: now } },
  );
  return result.modifiedCount;
}

export async function assignLead(
  kind: LeadKind,
  id: string,
  assignedToId: string | null,
  now = new Date(),
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await collectionFor(kind);
  const result = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    { $set: { assignedToId, updatedAt: now } },
  );
  return result.matchedCount === 1;
}

export async function addLeadNote(
  kind: LeadKind,
  id: string,
  note: { authorId: string | null; authorName: string; body: string },
  now = new Date(),
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;

  const entry: ActivityNote = {
    id: new ObjectId().toHexString(),
    authorId: note.authorId,
    authorName: note.authorName.slice(0, 120),
    body: note.body.trim().slice(0, 4_000),
    createdAt: now,
  };

  const collection = await collectionFor(kind);
  const result = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    { $push: { notes: entry }, $set: { updatedAt: now } },
  );
  return result.matchedCount === 1;
}

export async function recordLeadContacted(
  kind: LeadKind,
  id: string,
  now = new Date(),
): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const collection = await collectionFor(kind);
  await collection.updateOne({ _id: new ObjectId(id) } as Filter<Document>, {
    $set: { lastContactedAt: now, updatedAt: now },
  });
}

/** Every matching lead, for the export. Bounded so one click cannot exhaust memory. */
export async function listLeadsForExport(
  query: LeadQuery = {},
  limit = 5_000,
): Promise<LeadSummary[]> {
  const page = await listLeads({ ...query, page: 1, pageSize: 100 });
  const items = [...page.items];

  for (
    let next = 2;
    items.length < Math.min(limit, page.total) && next <= page.totalPages;
    next += 1
  ) {
    const more = await listLeads({ ...query, page: next, pageSize: 100 });
    items.push(...more.items);
  }

  return items.slice(0, limit);
}
