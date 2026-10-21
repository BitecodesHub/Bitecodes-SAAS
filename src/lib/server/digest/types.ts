import type { EmailBlock } from "@/lib/email/template";

/**
 * One section of the owner's digest and weekly report.
 *
 * Each growth package contributes one section from
 * `src/lib/server/digest/sections/<name>.ts`, exporting
 * `buildSection(range): Promise<DigestSection | null>`. Return null when there
 * is nothing worth reporting, so the email stays short. `collect.ts` calls
 * every section with a timeout and drops failures, so one broken section
 * never stops the digest.
 */

/** The reporting window: `from` inclusive, `to` exclusive. */
export interface DigestRange {
  from: Date;
  to: Date;
}

export interface DigestMetric {
  label: string;
  value: number | string;
  /** Change against the previous period, when known (e.g. "+12%"). */
  change?: string | null;
}

export interface DigestSection {
  /** Stable id, matching the section file name. */
  id: string;
  /** The section heading, e.g. "Leads". */
  title: string;
  /** One plain sentence, used in previews and the weekly AI summary. */
  summary: string;
  /** Key numbers, for the admin growth page and the weekly report. */
  metrics: DigestMetric[];
  /** Body rendered under the heading in email. Closed block set; escaped. */
  blocks: EmailBlock[];
  /** Things that need the owner, each with an admin link. */
  actions?: { label: string; href: string }[];
}

export type DigestSectionBuilder = (
  range: DigestRange,
) => Promise<DigestSection | null>;
