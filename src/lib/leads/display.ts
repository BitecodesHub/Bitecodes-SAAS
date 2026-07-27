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

export type LeadKind = "enquiry" | "consultant" | "audit";

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
  status: LeadStatus;
  budget: string | null;
  source: string | null;
  noteCount: number;
  assignedToId: string | null;
  createdAt: Date;
  /** Audit leads only: the score, which is the whole point of that lead. */
  score: number | null;
}

export interface LeadQuery {
  search?: string;
  status?: LeadStatus | "all";
  kind?: LeadKind | "all";
  assignedToId?: string;
  page?: number;
  pageSize?: number;
}

export const LEAD_PAGE_SIZE = 25;

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
};

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

  const normalised = words.map((word, index) => {
    // An all-capitals run is an acronym; leave it alone.
    if (word.length > 1 && word === word.toUpperCase()) return word;
    return index === 0 ? word.toLowerCase() : word.toLowerCase();
  });

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
  "status",
  "name",
  "email",
  "company",
  "budget",
  "source",
  "score",
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
