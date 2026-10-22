import type { LeadStatus } from "@/lib/server/db/types";

/**
 * Client-safe lead vocabulary: types, labels, and pure formatting.
 *
 * Deliberately separate from `lib/server/leads/repository.ts`. That module is
 * marked `server-only` and imports the MongoDB driver, so a client component
 * that reached in for a label would drag the entire driver into the browser
 * bundle — which is exactly what happened, and what the build caught. Anything
 * both sides need lives here instead.
 *
 * (`LeadStatus` is a type-only import, erased at compile time, so it carries no
 * runtime dependency.)
 */

/**
 * Where a lead actually is.
 *
 * `contacted` is the stage the old `LeadStatus` union was missing: a reply or a
 * call is not the same thing as a qualified opportunity, and forcing an
 * operator to choose between "new" and "qualified" loses the most useful state
 * in a pipeline. Legacy `spam` folds into `lost`; the two mean the same thing
 * commercially.
 */
export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost";

/** Quality band derived from the deterministic score. */
export type LeadGrade = "A" | "B" | "C" | "D";

export type LeadKind =
  | "enquiry"
  | "consultant"
  | "audit"
  /** Staff-owned embedded form submission, read-only in the inbox. */
  | "form"
  /** Staff-owned booking, read-only in the inbox. */
  | "booking";

/** Kinds we can write CRM changes to. Forms and bookings stay read-only. */
export const WRITABLE_LEAD_KINDS: LeadKind[] = [
  "enquiry",
  "consultant",
  "audit",
];

export function isWritableLeadKind(kind: LeadKind): boolean {
  return kind !== "form" && kind !== "booking";
}

/** One row of the inbox, whichever door the lead came through. */
export interface LeadSummary {
  id: string;
  kind: LeadKind;
  reference: string;
  name: string | null;
  email: string | null;
  company: string | null;
  /** One line describing what they asked for. */
  summary: string;
  /** The current pipeline stage (preferred over the legacy status). */
  stage: LeadStage;
  /** Legacy status, kept so older callers and exports keep working. */
  status: LeadStatus;
  budget: string | null;
  source: string | null;
  noteCount: number;
  assignedToId: string | null;
  createdAt: Date;
  /** Deterministic lead-quality score (0–100), when one has been computed. */
  score: number | null;
  grade: LeadGrade | null;
  /** Website audit's own score. Separate from lead quality on purpose. */
  auditScore: number | null;
  nextAction: string | null;
  nextActionAt: Date | null;
  /** True for staff-owned form submissions and bookings. */
  readOnly: boolean;
}

export interface LeadQuery {
  search?: string;
  /** New name. `status` is accepted as a legacy alias. */
  stage?: LeadStage | "all";
  status?: LeadStatus | LeadStage | "all";
  kind?: LeadKind | "all";
  assignedToId?: string;
  minScore?: number;
  sort?: "recent" | "score" | "next-action";
  page?: number;
  pageSize?: number;
}

export const LEAD_PAGE_SIZE = 25;

/** Canonical pipeline order. */
export const LEAD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

/** Legacy stage list, retained for bulk-action compatibility. */
export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "qualified",
  "proposal",
  "won",
  "lost",
  "spam",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal sent",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
};

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  enquiry: "Contact form",
  consultant: "AI consultant",
  audit: "Website audit",
  form: "Embedded form",
  booking: "Booking",
};

/** Maps any legacy status to the stage it means today. */
export function legacyStatusToStage(
  status: LeadStatus | null | undefined,
): LeadStage {
  switch (status) {
    case "qualified":
      return "qualified";
    case "proposal":
      return "proposal";
    case "won":
      return "won";
    case "lost":
    case "spam":
      return "lost";
    case "new":
    default:
      return "new";
  }
}

/** The legacy status we write alongside a stage, for old readers. */
export function stageToLegacyStatus(stage: LeadStage): LeadStatus {
  switch (stage) {
    case "contacted":
      // The legacy union has no "contacted"; "new" is the least-wrong value.
      return "new";
    case "qualified":
      return "qualified";
    case "proposal":
      return "proposal";
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "new":
    default:
      return "new";
  }
}

/** Reads a stage from an arbitrary query-string value. */
export function parseLeadStage(value: unknown): LeadStage | null {
  return typeof value === "string" && (LEAD_STAGES as string[]).includes(value)
    ? (value as LeadStage)
    : null;
}

/** Human label for a stage, falling back for legacy unknown values. */
export function leadStageLabel(stage: LeadStage | null | undefined): string {
  return stage ? LEAD_STAGE_LABELS[stage] : "New";
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turns a submitted field key into a readable label.
 *
 * `projectType` → `Project type`, but `totalUSD` → `Total USD`. The acronym case
 * is the reason this is not a one-liner: naively lowercasing every word after
 * the first mangles `USD`, `SEO`, and `API`, and naively preserving case gives
 * the title-case mess `Project Type` beside the sentence-case `Budget`.
 *
 * The consultant brief's shape is not fixed — fields come and go — so labels are
 * derived rather than hand-maintained.
 */
export function humanizeFieldKey(key: string): string {
  const words = key
    // Split camelCase, but keep runs of capitals together.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "";

  // Keep short all-capital tokens (USD, SEO, API) intact; lowercase the rest
  // before applying sentence case. Lowercasing everything turned "totalUSD"
  // into "Total usd", which is wrong in a field label.
  const normalised = words.map((word) =>
    word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase(),
  );
  const first = normalised[0]!;
  const head =
    first === first.toUpperCase() && first.length > 1
      ? first
      : first.charAt(0).toUpperCase() + first.slice(1);

  return [head, ...normalised.slice(1)].join(" ");
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/** Fields exported to CSV, in column order. */
const CSV_COLUMNS = [
  "reference",
  "kind",
  "stage",
  "status",
  "name",
  "email",
  "company",
  "budget",
  "source",
  "score",
  "grade",
  "nextAction",
  "createdAt",
  "summary",
] as const;

/**
 * Escapes one CSV field.
 *
 * The leading-character guard is the important part: a value beginning `=`,
 * `+`, `-`, or `@` is executed as a formula when the file is opened in Excel or
 * Sheets. Since these values come from a public form, that is a live injection
 * path into the operator's spreadsheet, so such fields are prefixed with a
 * single quote to neutralise them.
 *
 * The guard is applied *before* quoting, so it survives the spreadsheet's own
 * unquoting step and is still the first character of the parsed value.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);
  // Strip control characters that would corrupt the row structure.
  text = text.replace(/[\r\n\t]+/g, " ").trim();

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",;]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;

  return text;
}

export function toCsv(rows: readonly LeadSummary[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","),
  );
  // CRLF and a UTF-8 BOM: without the BOM, Excel renders accented business
  // names as mojibake, which makes the export look broken.
  return `﻿${[header, ...lines].join("\r\n")}\r\n`;
}
