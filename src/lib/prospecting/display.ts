import type { ProspectStatus, ProspectTag } from "@/lib/server/db/types";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";

/**
 * Presentation helpers shared by the admin table, the map, and the public
 * report page.
 *
 * Kept separate from `classify.ts` so the classifier stays about commercial
 * logic, and separate from any component so three surfaces cannot drift into
 * three different colours for the same tag.
 */

export type TagSeverity = "critical" | "warning" | "opportunity" | "neutral";

/**
 * How urgent a tag looks.
 *
 * Only genuine breakage is `critical`. Inflating everything to red would make
 * the table unreadable and, on the customer-facing report, would read as a scare
 * tactic rather than an assessment.
 */
export const TAG_SEVERITY: Record<ProspectTag, TagSeverity> = {
  "website-down": "critical",
  "no-website": "critical",
  "not-mobile-friendly": "warning",
  "insecure-website": "warning",
  "slow-website": "warning",
  "seo-gaps": "opportunity",
  "accessibility-gaps": "opportunity",
  "feature-upgrade": "opportunity",
  "strong-website": "neutral",
};

/** Map-marker colour variant for a tag. */
export function tagMarkerVariant(
  tag: ProspectTag | null | undefined,
): "critical" | "warning" | "good" | "default" | "muted" {
  if (!tag) return "muted";
  switch (TAG_SEVERITY[tag]) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    case "opportunity":
      return "default";
    default:
      return "good";
  }
}

export function tagLabel(tag: ProspectTag | null | undefined): string {
  return tag ? PROSPECT_TAG_LABELS[tag] : "Not checked yet";
}

/** Badge variant from the existing UI primitive's vocabulary. */
export function tagBadgeVariant(
  tag: ProspectTag | null | undefined,
): "default" | "secondary" | "outline" | "muted" {
  if (!tag) return "muted";
  return TAG_SEVERITY[tag] === "neutral" ? "muted" : "default";
}

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  discovered: "Discovered",
  enriching: "Checking",
  qualified: "Qualified",
  queued: "Queued to email",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting booked",
  won: "Won",
  lost: "Lost",
  suppressed: "Suppressed",
};

/** The pipeline in the order it is worked, for the status filter and kanban. */
export const PROSPECT_PIPELINE: ProspectStatus[] = [
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

/** `1500` → `1.5 km`; `800` → `800 m`. */
export function formatRadius(meters: number): string {
  return meters >= 1_000
    ? `${(meters / 1_000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

/**
 * A 0-100 opportunity score as a short word.
 *
 * Operators triage far faster on "Hot" than on "83", and the number is still
 * shown beside it for anyone who wants it.
 */
export function scoreBand(score: number | null | undefined): {
  label: string;
  tone: "hot" | "warm" | "cool" | "cold";
} {
  if (typeof score !== "number") return { label: "—", tone: "cold" };
  if (score >= 80) return { label: "Hot", tone: "hot" };
  if (score >= 60) return { label: "Warm", tone: "warm" };
  if (score >= 40) return { label: "Cool", tone: "cool" };
  return { label: "Cold", tone: "cold" };
}

/** Strips the scheme and any trailing slash, for compact display. */
export function shortUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}
