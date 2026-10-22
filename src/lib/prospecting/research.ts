import { z } from "zod";
import { ICP_SEGMENTS, matchIcpSegment } from "@/data/icp";
import { services } from "@/data/services";

/**
 * Grounding rules for AI-written prospect research and outreach openings.
 *
 * The model never sees a fetched web page at research time — it sees the facts
 * the enrichment audit already stored and verified. That makes honesty a
 * checkable property rather than a hope: every number a hook or an opening
 * cites must appear in the fact sheet, and anything else (superlatives,
 * placeholders, links) is stripped or rejected before it reaches the database
 * or a real business's inbox.
 *
 * Everything here is pure and client-safe; the server module wraps the outputs
 * in `untrusted()` and makes the actual AI calls.
 */

export const SERVICE_SLUGS = services.map((service) => service.slug);
export const ICP_SEGMENT_IDS = ICP_SEGMENTS.map((segment) => segment.id);

/** The JSON shape the research model must return. */
export const prospectResearchSchema = z.object({
  summary: z.string().min(1).max(1_200),
  likelyNeeds: z.array(z.string().min(1).max(200)).max(6),
  icpSegmentId: z.string().max(80).nullable(),
  fitScore: z.number().min(0).max(100),
  personalizationHooks: z.array(z.string().min(1).max(300)).max(6),
  risks: z.array(z.string().min(1).max(200)).max(6),
  recommendedService: z.string().max(80).nullable(),
  doNotContactReason: z.string().max(200).nullable(),
});

export type ProspectResearchOutput = z.infer<typeof prospectResearchSchema>;

/** The JSON shape the outreach-opening model must return. */
export const outreachOpeningSchema = z.object({
  subject: z.string().min(3).max(160),
  opening: z.string().min(10).max(600),
});

export type OutreachOpeningOutput = z.infer<typeof outreachOpeningSchema>;

/**
 * Words that read as marketing rather than observation. A hook containing any
 * of these is dropped: "their website is the best in the city" is not a fact
 * the audit produced, and a recipient can tell.
 */
const HYPE_WORDS = [
  "amazing",
  "awful",
  "award-winning",
  "best",
  "better than anyone",
  "bleeding-edge",
  "brilliant",
  "cutting-edge",
  "exceptional",
  "fantastic",
  "game-changer",
  "game changer",
  "incredible",
  "leading",
  "leverage",
  "lightning-fast",
  "next-level",
  "outstanding",
  "perfect",
  "premier",
  "revolutionary",
  "seamless",
  "state-of-the-art",
  "superior",
  "top-notch",
  "unbeatable",
  "unlocked",
  "unlock",
  "world-class",
];

export function containsHype(text: string): boolean {
  const haystack = text.toLowerCase();
  return HYPE_WORDS.some((word) => haystack.includes(word));
}

/**
 * Removes template placeholders and collapses whitespace.
 *
 * The model is told not to emit `{{variables}}`, but a template placeholder
 * that slipped through would render as a missing variable and block the whole
 * message at the compliance gate — so it is removed here rather than trusted
 * away.
 */
export function sanitizeAiText(value: string, maxLength: number): string {
  return value
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

/** Numbers a text cites, normalised so "4.2" and "4.20" compare equal. */
export function citedNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((token) =>
    token
      .replace(/,/, ".")
      .replace(/\.?0+$/, "")
      .replace(/\.$/, ""),
  );
}

function allNumbersKnown(text: string, factSheet: string): boolean {
  const known = new Set(citedNumbers(factSheet));
  return citedNumbers(text).every((token) => known.has(token));
}

export interface HookValidationInput {
  hook: string;
  /** Everything the model was told, joined. A cited number must appear here. */
  factSheet: string;
  minLength?: number;
  maxLength?: number;
}

/**
 * Returns the cleaned hook, or null when it fails grounding.
 *
 * A rejected hook is never "fixed up": the fallback is the deterministic
 * classification issue list, which is short, verifiable, and already trusted.
 */
export function validateHook({
  hook,
  factSheet,
  minLength = 12,
  maxLength = 240,
}: HookValidationInput): string | null {
  const cleaned = sanitizeAiText(hook, maxLength);
  if (cleaned.length < minLength) return null;
  if (cleaned.includes("{{")) return null;
  if (containsHype(cleaned)) return null;
  if (!allNumbersKnown(cleaned, factSheet)) return null;
  return cleaned;
}

/**
 * Validates an AI-written opening paragraph for the outreach draft.
 * Same grounding rule as a hook, with room for two or three sentences.
 */
export function validateOpening(
  opening: string,
  factSheet: string,
): string | null {
  const cleaned = sanitizeAiText(opening, 480);
  if (cleaned.length < 20) return null;
  if (cleaned.includes("{{")) return null;
  if (containsHype(cleaned)) return null;
  if (!allNumbersKnown(cleaned, factSheet)) return null;
  return cleaned;
}

/** Validates an AI-written subject line. Falls back to the template subject. */
export function validateSubject(subject: string): string | null {
  const cleaned = sanitizeAiText(subject, 120);
  if (cleaned.length < 3) return null;
  if (cleaned.includes("{{")) return null;
  return cleaned;
}

// ---------------------------------------------------------------------------
// Fact sheet
// ---------------------------------------------------------------------------

/** The plain fields of a prospect the fact sheet is built from. */
export interface ResearchFactInput {
  name: string;
  categoryLabel?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  signals?: {
    reachable: boolean;
    https: boolean;
    responsive: boolean;
    responseTimeMs: number | null;
    htmlBytes: number | null;
    hasStructuredData: boolean;
    hasOpenGraph: boolean;
    hasAnalytics: boolean;
    hasBooking: boolean;
    hasEcommerce: boolean;
    hasChat: boolean;
    hasBlog: boolean;
    hasContactForm: boolean;
    platform: string | null;
    copyrightYear: number | null;
  } | null;
  classification?: {
    primaryTag: string;
    topIssues: string[];
    score: number;
  } | null;
  auditScore?: number | null;
}

export interface ResearchFactSheet {
  /** One verifiable fact per line. The grounding source for every number. */
  lines: string[];
  /** The lines joined, for number checks. */
  text: string;
  /** The deterministic ICP hint, when the name and category match a segment. */
  segmentId: string | null;
  segmentName: string | null;
}

/**
 * Builds the audit fact sheet from stored enrichment output.
 *
 * Every line is something the passive audit measured, so the model cannot
 * observe anything it was not given. A business the check could not reach gets
 * that fact, not a polite invention.
 */
export function buildResearchFacts(
  input: ResearchFactInput,
): ResearchFactSheet {
  const lines: string[] = [];

  lines.push(`Business name: ${input.name}`);
  if (input.categoryLabel) lines.push(`Listed as: ${input.categoryLabel}`);
  if (input.city || input.region || input.countryCode) {
    lines.push(
      `Location: ${[input.city, input.region, input.countryCode]
        .filter(Boolean)
        .join(", ")}`,
    );
  }
  if (input.website) lines.push(`Website: ${input.website}`);
  if (!input.website && input.socialUrl) {
    lines.push(
      "Website: none found; the business is listed only through a social media page",
    );
  }

  const signals = input.signals;
  if (signals) {
    if (!signals.reachable) {
      lines.push(
        "The website did not load when the audit checked it (DNS, connection, TLS, or server error).",
      );
    } else {
      lines.push("The website loaded when the audit checked it.");
      lines.push(
        signals.https
          ? "HTTPS is in place."
          : "No HTTPS: browsers show the site as not secure.",
      );
      lines.push(
        signals.responsive
          ? "The site declares a mobile layout."
          : "The site declares no mobile layout; it renders as a shrunken desktop page.",
      );
      if (typeof signals.responseTimeMs === "number") {
        lines.push(
          `Measured server response time: ${(signals.responseTimeMs / 1000).toFixed(1)} seconds.`,
        );
      }
      if (typeof signals.htmlBytes === "number") {
        lines.push(`HTML size: ${Math.round(signals.htmlBytes / 1024)} KB.`);
      }
      lines.push(
        signals.hasBooking
          ? "Online booking is present."
          : "No online booking found.",
      );
      lines.push(
        signals.hasContactForm
          ? "A contact or enquiry form is present."
          : "No contact form found.",
      );
      lines.push(
        signals.hasEcommerce
          ? "Online ordering or a shop is present."
          : "No online ordering found.",
      );
      lines.push(
        signals.hasChat ? "A chat widget is present." : "No chat widget found.",
      );
      lines.push(
        signals.hasAnalytics
          ? "Web analytics is present."
          : "No web analytics found.",
      );
      lines.push(signals.hasBlog ? "A blog is present." : "No blog found.");
      lines.push(
        signals.hasStructuredData
          ? "Structured data markup is present."
          : "No structured data markup found.",
      );
      lines.push(
        signals.hasOpenGraph
          ? "Social preview tags are present."
          : "No social preview tags found.",
      );
      if (signals.platform)
        lines.push(`Platform detected: ${signals.platform}.`);
      if (typeof signals.copyrightYear === "number") {
        lines.push(`Footer copyright year: ${signals.copyrightYear}.`);
      }
    }
  }

  if (typeof input.auditScore === "number") {
    lines.push(`Overall audit score: ${input.auditScore} out of 100.`);
  }

  if (input.classification) {
    lines.push(
      `Automated classification: ${input.classification.primaryTag} (opportunity score ${input.classification.score} of 100).`,
    );
    for (const issue of input.classification.topIssues) {
      lines.push(`Observed issue: ${issue}`);
    }
  }

  const match = matchIcpSegment(
    [input.name, input.categoryLabel, input.city].filter(Boolean).join(" "),
  );

  return {
    lines,
    text: lines.join("\n"),
    segmentId: match?.segment.id ?? null,
    segmentName: match?.segment.name ?? null,
  };
}

/**
 * The service catalogue line for the research prompt, so the model can only
 * recommend services that exist.
 */
export function serviceCatalogueLine(): string {
  return services
    .map((service) => `${service.slug} (${service.title})`)
    .join(", ");
}
