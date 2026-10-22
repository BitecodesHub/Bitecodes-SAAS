import "server-only";

import { ObjectId, type Document, type Filter } from "mongodb";
import {
  adminUsers,
  auditReports,
  bookings,
  consultantRequests,
  contactEnquiries,
  formSubmissions,
} from "@/lib/server/db/collections";
import { COLLECTIONS } from "@/lib/server/db/schema";
import type {
  ActivityNote,
  AuditReportDoc,
  BookingDoc,
  ConsultantRequestDoc,
  ContactEnquiryDoc,
  FormSubmissionDoc,
  LeadActivityDoc,
  LeadGrade,
  LeadQualification,
  LeadStage,
  LeadStatus,
} from "@/lib/server/db/types";
import {
  escapeRegExp,
  legacyStatusToStage,
  LEAD_PAGE_SIZE,
  stageToLegacyStatus,
  type LeadKind,
  type LeadQuery,
  type LeadSummary,
} from "@/lib/leads/display";
import { scoreLead } from "@/lib/leads/score";

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
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  isWritableLeadKind,
  legacyStatusToStage,
  parseLeadStage,
  stageToLegacyStatus,
  toCsv,
  type LeadKind,
  type LeadQuery,
  type LeadSummary,
} from "@/lib/leads/display";

/**
 * The unified leads inbox.
 *
 * Inbound interest arrives through five doors — the contact form, the AI
 * consultant, the free website audit, staff-owned embedded forms, and staff
 * bookings — and lands in five collections with different shapes. An operator
 * does not care about that distinction: they want one list, newest first, with
 * the ability to filter and move a stage.
 *
 * Reads go through one `$unionWith` aggregation that projects every source into
 * `LeadSummary`. The alternative — five queries merged in memory — cannot
 * paginate or count correctly, because "page 2 of the union" is not derivable
 * from "page 2 of each part".
 *
 * Writes stay per-collection for the three sales-owned sources. Form
 * submissions and bookings are deliberately read-only: they belong to a
 * customer's product data, and letting a sales operator edit them would blur
 * ownership and could corrupt a customer's records. A staff-owned form or
 * booking can be read here, never modified.
 */

// ---------------------------------------------------------------------------
// Shared projection helpers
// ---------------------------------------------------------------------------

const STAFF_ROLES = ["owner", "admin", "editor", "viewer"] as const;

/**
 * Staff account ids, as hex strings.
 *
 * Form submissions and bookings carry `ownerId`; only a *staff*-owned one is a
 * Bitecodes lead. Customer-owned submissions are product data and must never
 * appear in this inbox. A query failure returns no ids, which hides those
 * sources rather than leaking a customer's data.
 */
async function staffOwnerIds(): Promise<string[]> {
  try {
    const users = await adminUsers();
    const rows = await users
      .find({ role: { $in: [...STAFF_ROLES] } }, { projection: { _id: 1 } })
      .toArray();
    return rows.map((row) => row._id.toHexString());
  } catch {
    return [];
  }
}

/** Maps a persisted legacy status to a stage inside an aggregation. */
function stageFromStatus(statusExpression: unknown): Document {
  return {
    $switch: {
      branches: [
        { case: { $eq: [statusExpression, "contacted"] }, then: "contacted" },
        { case: { $eq: [statusExpression, "qualified"] }, then: "qualified" },
        { case: { $eq: [statusExpression, "proposal"] }, then: "proposal" },
        { case: { $eq: [statusExpression, "won"] }, then: "won" },
        {
          case: { $in: [statusExpression, ["lost", "spam"]] },
          then: "lost",
        },
      ],
      default: "new",
    },
  };
}

/** The persisted stage wins; the legacy status is only a fallback. */
function stageExpression(statusExpression: unknown): Document {
  return { $ifNull: ["$stage", stageFromStatus(statusExpression)] };
}

/** The first value in `$data` whose field name matches a pattern. */
function formFieldExpression(pattern: string): Document {
  return {
    $let: {
      vars: {
        entry: {
          $first: {
            $filter: {
              input: { $objectToArray: { $ifNull: ["$data", {}] } },
              as: "field",
              cond: {
                $regexMatch: {
                  input: "$$field.k",
                  regex: pattern,
                  options: "i",
                },
              },
            },
          },
        },
      },
      in: {
        $convert: {
          input: "$$entry.v",
          to: "string",
          onError: null,
          onNull: null,
        },
      },
    },
  };
}

function commonSummaryProjection(): Document {
  return {
    noteCount: { $size: { $ifNull: ["$notes", []] } },
    assignedToId: { $ifNull: ["$assignedToId", null] },
    createdAt: 1,
    updatedAt: 1,
    score: { $ifNull: ["$score", null] },
    grade: { $ifNull: ["$grade", null] },
    nextAction: { $ifNull: ["$nextAction", null] },
    nextActionAt: { $ifNull: ["$nextActionAt", null] },
    readOnly: { $literal: false },
  };
}

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
      stage: stageExpression("$status"),
      budget: "$budget",
      source: { $ifNull: ["$source", "contact-form"] },
      auditScore: { $literal: null },
      ...commonSummaryProjection(),
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
      stage: stageExpression("$status"),
      budget: { $ifNull: ["$input.budget", null] },
      source: { $literal: "ai-consultant" },
      auditScore: { $literal: null },
      ...commonSummaryProjection(),
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
      stage: stageExpression("$status"),
      budget: { $literal: null },
      source: { $ifNull: ["$source", "public-tool"] },
      // The audit's own score is not lead quality. Keeping both columns stops
      // an 85/100 website from looking like an 85/100 buyer.
      auditScore: { $ifNull: ["$result.overallScore", null] },
      ...commonSummaryProjection(),
    },
  };
}

function formProjection(staffIds: string[]): Document[] {
  return [
    { $match: { ownerId: { $in: staffIds } } },
    {
      $project: {
        _id: 1,
        kind: { $literal: "form" },
        reference: {
          $concat: [
            "FORM-",
            { $toUpper: { $substrCP: ["$submissionId", 0, 8] } },
          ],
        },
        name: {
          $ifNull: [
            formFieldExpression("^(full_?name|name)$"),
            "Form submission",
          ],
        },
        email: formFieldExpression("e-?mail"),
        company: formFieldExpression("company|organi[sz]ation|business"),
        summary: {
          $ifNull: [
            formFieldExpression("message|comment|notes?|details?|enquiry"),
            "Submitted an embedded form.",
          ],
        },
        status: {
          $switch: {
            branches: [
              { case: { $eq: ["$status", "spam"] }, then: "spam" },
              { case: { $eq: ["$status", "archived"] }, then: "lost" },
            ],
            default: "new",
          },
        },
        stage: {
          $switch: {
            branches: [
              { case: { $eq: ["$status", "spam"] }, then: "lost" },
              { case: { $eq: ["$status", "archived"] }, then: "lost" },
            ],
            default: "new",
          },
        },
        budget: { $literal: null },
        source: { $literal: "embedded-form" },
        auditScore: { $literal: null },
        noteCount: { $literal: 0 },
        assignedToId: { $literal: null },
        createdAt: 1,
        updatedAt: 1,
        score: { $literal: null },
        grade: { $literal: null },
        nextAction: { $literal: null },
        nextActionAt: { $literal: null },
        readOnly: { $literal: true },
      },
    },
  ];
}

function bookingProjection(staffIds: string[]): Document[] {
  return [
    { $match: { ownerId: { $in: staffIds } } },
    {
      $project: {
        _id: 1,
        kind: { $literal: "booking" },
        reference: {
          $concat: ["BK-", { $toUpper: { $substrCP: ["$bookingId", 0, 8] } }],
        },
        name: "$customerName",
        email: "$customerEmail",
        company: { $literal: null },
        summary: {
          $concat: [
            "Booked a call for ",
            {
              $dateToString: {
                date: "$startAt",
                format: "%d %b %Y, %H:%M UTC",
                timezone: "UTC",
              },
            },
          ],
        },
        status: {
          $cond: [{ $eq: ["$status", "confirmed"] }, "qualified", "lost"],
        },
        stage: {
          $cond: [{ $eq: ["$status", "confirmed"] }, "qualified", "lost"],
        },
        budget: { $literal: null },
        source: { $literal: "booking" },
        auditScore: { $literal: null },
        noteCount: { $literal: 0 },
        assignedToId: { $literal: null },
        createdAt: 1,
        updatedAt: 1,
        score: { $literal: null },
        grade: { $literal: null },
        nextAction: { $literal: null },
        nextActionAt: { $literal: null },
        readOnly: { $literal: true },
      },
    },
  ];
}

/** The union stages shared by every read, so the projections cannot drift. */
async function unifiedStages(): Promise<Document[]> {
  const staffIds = await staffOwnerIds();
  const stages: Document[] = [
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
  ];

  if (staffIds.length > 0) {
    stages.push(
      {
        $unionWith: {
          coll: COLLECTIONS.formSubmissions,
          pipeline: formProjection(staffIds),
        },
      },
      {
        $unionWith: {
          coll: COLLECTIONS.bookings,
          pipeline: bookingProjection(staffIds),
        },
      },
    );
  }

  return stages;
}

/**
 * Post-union filter.
 *
 * Applied after projection rather than per-collection so one predicate covers
 * every shape. The cost is that it cannot use each collection's indexes; that
 * is acceptable for an inbox an operator scrolls, and the alternative is five
 * divergent filters that would drift out of step.
 */
function buildUnionFilter(query: LeadQuery): Filter<Document> {
  const filter: Filter<Document> = {};

  const stage =
    query.stage && query.stage !== "all"
      ? query.stage
      : query.status && query.status !== "all"
        ? isLeadStage(query.status)
          ? query.status
          : legacyStatusToStage(query.status)
        : null;
  if (stage) filter.stage = stage;

  if (query.kind && query.kind !== "all") filter.kind = query.kind;
  if (query.assignedToId) filter.assignedToId = query.assignedToId;
  if (typeof query.minScore === "number")
    filter.score = { $gte: query.minScore };

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

function isLeadStage(value: string): value is LeadStage {
  return (
    value === "new" ||
    value === "contacted" ||
    value === "qualified" ||
    value === "proposal" ||
    value === "won" ||
    value === "lost"
  );
}

function sortFor(query: LeadQuery): Document {
  switch (query.sort) {
    case "score":
      return { score: -1, createdAt: -1, _id: -1 };
    case "next-action":
      return { nextActionAt: 1, createdAt: -1, _id: -1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}

/**
 * Scores read-only form/booking rows in memory.
 *
 * The aggregation cannot call the TypeScript scorer, and pushing a second copy
 * of the weights into `$switch` would guarantee the two drift. Read-only rows
 * are not used for score filters — the board is a triage view, not a report —
 * so a small in-memory pass is the honest trade.
 */
function enrichReadOnlyScore(row: LeadSummary): LeadSummary {
  if (row.kind !== "form" && row.kind !== "booking") return row;
  if (typeof row.score === "number") return row;

  const result = scoreLead({
    name: row.name,
    email: row.email,
    company: row.company,
    message: row.summary,
    source: row.source,
    kind: row.kind,
    budget: row.budget,
  });
  return { ...row, score: result.score, grade: result.grade };
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

  // One round trip for the page and the count. `$facet` keeps them consistent:
  // counting separately can disagree with the page when a lead arrives between
  // the two queries, which shows as a phantom empty final page.
  const [result] = await enquiries
    .aggregate<{
      rows: Array<
        Omit<LeadSummary, "id" | "score" | "grade"> & {
          _id: ObjectId;
          score: number | null;
          grade: LeadGrade | null;
        }
      >;
      total: Array<{ count: number }>;
    }>([
      ...(await unifiedStages()),
      { $match: filter },
      {
        $facet: {
          rows: [
            { $sort: sortFor(query) },
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
    items: (result?.rows ?? []).map(({ _id, ...row }) =>
      enrichReadOnlyScore({ ...row, id: _id.toHexString() } as LeadSummary),
    ),
    total,
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalPages,
  };
}

/** Counts per stage and per kind, for the filter chips, board, and dashboard. */
export async function getLeadStats(): Promise<{
  total: number;
  byStage: Record<string, number>;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
}> {
  const enquiries = await contactEnquiries();

  const rows = await enquiries
    .aggregate<{
      _id: { stage: string; status: string; kind: string };
      count: number;
    }>([
      ...(await unifiedStages()),
      {
        $group: {
          _id: { stage: "$stage", status: "$status", kind: "$kind" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byStage: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    total += row.count;
    byStage[row._id.stage] = (byStage[row._id.stage] ?? 0) + row.count;
    byStatus[row._id.status] = (byStatus[row._id.status] ?? 0) + row.count;
    byKind[row._id.kind] = (byKind[row._id.kind] ?? 0) + row.count;
  }

  return { total, byStage, byStatus, byKind };
}

/** Daily counts for the dashboard trend, sparse rows only. */
export async function getLeadTrend(
  from: Date,
  to: Date,
): Promise<Array<{ _id: string; count: number }>> {
  const enquiries = await contactEnquiries();
  return enquiries
    .aggregate<{ _id: string; count: number }>([
      ...(await unifiedStages()),
      { $match: { createdAt: { $gte: from, $lt: to } } },
      {
        $group: {
          // Grouped in UTC so buckets do not shift with the server timezone or
          // across a daylight-saving boundary.
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
}

/** Counts every lead source in a half-open time window. */
export async function countLeadsInRange(from: Date, to: Date): Promise<number> {
  const enquiries = await contactEnquiries();
  const [row] = await enquiries
    .aggregate<{
      count: number;
    }>([
      ...(await unifiedStages()),
      { $match: { createdAt: { $gte: from, $lt: to } } },
      { $count: "count" },
    ])
    .toArray();
  return row?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Single-lead reads and writes
// ---------------------------------------------------------------------------

export type LeadDetail =
  | { kind: "enquiry"; doc: ContactEnquiryDoc }
  | { kind: "consultant"; doc: ConsultantRequestDoc }
  | { kind: "audit"; doc: AuditReportDoc }
  | { kind: "form"; doc: FormSubmissionDoc }
  | { kind: "booking"; doc: BookingDoc };

/** Reads the first matching key from a form submission's free-form data. */
export function submissionField(
  data: FormSubmissionDoc["data"],
  pattern: RegExp,
): string | null {
  for (const [key, value] of Object.entries(data)) {
    if (!pattern.test(key)) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value) && value.length > 0) return value.join(", ");
  }
  return null;
}

/**
 * Loads one lead.
 *
 * The kind must be supplied by the caller (it is in the URL) rather than
 * discovered by probing collections: an ObjectId is only unique within a
 * collection, so probing could return the wrong document.
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
    case "form": {
      const doc = await (await formSubmissions()).findOne({ _id });
      if (!doc) return null;
      const staff = new Set(await staffOwnerIds());
      return staff.has(doc.ownerId) ? { kind, doc } : null;
    }
    case "booking": {
      const doc = await (await bookings()).findOne({ _id });
      if (!doc) return null;
      const staff = new Set(await staffOwnerIds());
      return staff.has(doc.ownerId) ? { kind, doc } : null;
    }
    default:
      return null;
  }
}

type WritableLeadKind = "enquiry" | "consultant" | "audit";

function isWritableKind(kind: LeadKind): kind is WritableLeadKind {
  return kind === "enquiry" || kind === "consultant" || kind === "audit";
}

async function collectionFor(kind: LeadKind) {
  if (!isWritableKind(kind)) return null;
  switch (kind) {
    case "enquiry":
      return contactEnquiries();
    case "consultant":
      return consultantRequests();
    case "audit":
      return auditReports();
  }
}

function objectIds(ids: readonly string[]): ObjectId[] {
  return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
}

/**
 * Moves leads to a stage, writing the legacy status in the same update.
 *
 * Writing both is not redundancy for its own sake: proposals and other packages
 * still read `status`, and a stage change that left it stale would make one lead
 * appear in two different columns depending on which screen was open.
 */
export async function setLeadStage(
  kind: LeadKind,
  ids: readonly string[],
  stage: LeadStage,
  now = new Date(),
): Promise<number> {
  const collection = await collectionFor(kind);
  if (!collection) return 0;
  const _ids = objectIds(ids);
  if (_ids.length === 0) return 0;

  const result = await collection.updateMany(
    { _id: { $in: _ids } } as Filter<Document>,
    {
      $set: {
        stage,
        status: stageToLegacyStatus(stage),
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount;
}

/** Legacy entry point. Prefer `setLeadStage` for new code. */
export async function setLeadStatus(
  kind: LeadKind,
  ids: readonly string[],
  status: LeadStatus,
  now = new Date(),
): Promise<number> {
  const collection = await collectionFor(kind);
  if (!collection) return 0;
  const _ids = objectIds(ids);
  if (_ids.length === 0) return 0;

  const result = await collection.updateMany(
    { _id: { $in: _ids } } as Filter<Document>,
    {
      $set: {
        stage: legacyStatusToStage(status),
        status,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount;
}

export async function assignLead(
  kind: LeadKind,
  id: string,
  assignedToId: string | null,
  now = new Date(),
): Promise<boolean> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return false;
  const result = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    { $set: { assignedToId, updatedAt: now } },
  );
  return result.matchedCount === 1;
}

export async function setLeadNextAction(
  kind: LeadKind,
  id: string,
  nextAction: string | null,
  nextActionAt: Date | null,
  now = new Date(),
): Promise<boolean> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return false;
  const result = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    {
      $set: {
        nextAction: nextAction?.trim().slice(0, 240) || null,
        nextActionAt,
        updatedAt: now,
      },
    },
  );
  return result.matchedCount === 1;
}

export async function setLeadOwnerNotes(
  kind: LeadKind,
  id: string,
  notes: string,
  now = new Date(),
): Promise<boolean> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return false;
  const result = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    {
      $set: {
        ownerNotes: notes.trim().slice(0, 8_000) || null,
        updatedAt: now,
      },
    },
  );
  return result.matchedCount === 1;
}

export async function addLeadNote(
  kind: LeadKind,
  id: string,
  note: { authorId: string | null; authorName: string; body: string },
  now = new Date(),
): Promise<boolean> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return false;

  const entry: ActivityNote = {
    id: new ObjectId().toHexString(),
    authorId: note.authorId,
    authorName: note.authorName.slice(0, 120),
    body: note.body.trim().slice(0, 4_000),
    createdAt: now,
  };

  const result = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    { $push: { notes: entry }, $set: { updatedAt: now } },
  );

  if (result.matchedCount === 1) {
    await recordLeadActivity(
      {
        leadKind: kind,
        leadId: id,
        email: null,
        type: "note",
        summary: `${entry.authorName} added a note.`,
        detail: { noteId: entry.id },
        actorId: note.authorId,
      },
      now,
    );
  }
  return result.matchedCount === 1;
}

export async function recordLeadContacted(
  kind: LeadKind,
  id: string,
  now = new Date(),
): Promise<void> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return;
  await collection.updateOne({ _id: new ObjectId(id) } as Filter<Document>, {
    $set: { lastContactedAt: now, updatedAt: now },
  });
}

/** Writes the deterministic score without touching stage or qualification. */
export async function saveLeadScore(
  kind: LeadKind,
  id: string,
  result: {
    score: number;
    grade: LeadGrade;
    reasons: string[];
    segmentId: string | null;
  },
  now = new Date(),
): Promise<boolean> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return false;
  const update: Record<string, unknown> = {
    score: result.score,
    grade: result.grade,
    scoreReasons: result.reasons,
    scoredAt: now,
    updatedAt: now,
  };
  // Write null when nothing matches, so a stale segment cannot survive a
  // rescore after the lead's wording changes.
  update.scoreSegmentId = result.segmentId;
  const saved = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    { $set: update },
  );
  return saved.matchedCount === 1;
}

/** Stores the AI qualification note. Never writes `score`. */
export async function saveLeadQualification(
  kind: LeadKind,
  id: string,
  qualification: LeadQualification,
  now = new Date(),
): Promise<boolean> {
  const collection = await collectionFor(kind);
  if (!collection || !ObjectId.isValid(id)) return false;
  const suggestedNextAction = qualification.suggestedNextAction.slice(0, 240);
  const saved = await collection.updateOne(
    { _id: new ObjectId(id) } as Filter<Document>,
    [
      {
        $set: {
          qualification,
          // The AI suggests; it does not overwrite a step a person already
          // committed to. A daily job silently replacing the operator's next
          // action would make the field untrustworthy.
          nextAction: {
            $cond: [
              {
                $in: [{ $ifNull: ["$nextAction", ""] }, ["", null]],
              },
              suggestedNextAction,
              "$nextAction",
            ],
          },
          // The score ignores the qualification note, so it is still current.
          // Moving `scoredAt` with this write stops the next daily run from
          // treating our own qualification write as a lead change.
          scoredAt: now,
          updatedAt: now,
        },
      },
    ],
  );
  return saved.matchedCount === 1;
}

/** Appends one timeline entry. Failure is logged by the caller, never thrown. */
export async function recordLeadActivity(
  input: {
    leadKind: LeadKind;
    leadId: string;
    email: string | null;
    type: string;
    summary: string;
    detail?: Record<string, unknown> | null;
    actorId?: string | null;
  },
  now = new Date(),
): Promise<void> {
  const collection = await (
    await import("@/lib/server/db/collections")
  ).leadActivities();
  await collection.insertOne({
    leadKind: input.leadKind,
    leadId: input.leadId,
    email: input.email?.trim().toLowerCase() || null,
    type: input.type.slice(0, 60),
    summary: input.summary.slice(0, 500),
    detail: input.detail ?? null,
    actorId: input.actorId ?? null,
    createdAt: now,
  } as LeadActivityDoc);
}

/** Timeline for one lead, newest first. */
export async function listLeadActivities(
  kind: LeadKind,
  id: string,
  limit = 100,
): Promise<LeadActivityDoc[]> {
  const { leadActivities } = await import("@/lib/server/db/collections");
  const collection = await leadActivities();
  return collection
    .find({ leadKind: kind, leadId: id })
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .toArray();
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

/**
 * A compact snapshot for the owner digest.
 *
 * The source split uses the same union as the inbox, so a lead counted in the
 * digest is counted exactly once, and staff-owned forms/bookings are included
 * only when the inbox would show them. "Waiting" means new or contacted for
 * more than a day: the point is to surface neglect, not every fresh enquiry.
 */
export async function getLeadDigestData(
  from: Date,
  to: Date,
  now = new Date(),
): Promise<{
  byKind: Record<string, number>;
  waiting: LeadSummary[];
  waitingTotal: number;
}> {
  const enquiries = await contactEnquiries();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [kindRows, waitingRows, waitingCount] = await Promise.all([
    enquiries
      .aggregate<{
        _id: string;
        count: number;
      }>([
        ...(await unifiedStages()),
        { $match: { createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: "$kind", count: { $sum: 1 } } },
      ])
      .toArray(),
    enquiries
      .aggregate<LeadSummary>([
        ...(await unifiedStages()),
        {
          $match: {
            stage: { $in: ["new", "contacted"] },
            createdAt: { $lt: oneDayAgo },
          },
        },
        { $sort: { createdAt: 1 } },
        { $limit: 5 },
      ])
      .toArray(),
    enquiries
      .aggregate<{ count: number }>([
        ...(await unifiedStages()),
        {
          $match: {
            stage: { $in: ["new", "contacted"] },
            createdAt: { $lt: oneDayAgo },
          },
        },
        { $count: "count" },
      ])
      .toArray(),
  ]);

  return {
    byKind: Object.fromEntries(kindRows.map((row) => [row._id, row.count])),
    waiting: waitingRows,
    waitingTotal: waitingCount[0]?.count ?? 0,
  };
}
