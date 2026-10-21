import {
  ICP_DISQUALIFIERS,
  ICP_SEGMENTS,
  getIcpSegment,
  isFreeMailDomain,
  matchIcpSegment,
  type IcpCountry,
  type IcpSegment,
} from "@/data/icp";
import type { LeadGrade, LeadStage } from "@/lib/leads/display";

/**
 * Deterministic lead scoring.
 *
 * Pure on purpose. The same enquiry must receive the same score today, next
 * week, and in a test, so nothing here reads the clock, the database, or a
 * model. AI is allowed to add a qualification note later; it is not allowed to
 * move the number, because a score that changes when a provider changes is not
 * a metric an operator can act on.
 *
 * The weights are opinionated but visible. Every point a lead earns is named in
 * `reasons`, which is what makes the score defensible in a pipeline review:
 * "82 — business email, healthcare segment, budget and timing signals" can be
 * argued with, whereas a bare number cannot.
 */

export type LeadFit = "strong" | "possible" | "poor";

export interface LeadEngagement {
  /** Marketing emails opened. */
  opens?: number;
  /** Tracked links clicked. */
  clicks?: number;
  /** Replies received. */
  replies?: number;
}

export interface LeadScoreInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  budget?: string | null;
  timeline?: string | null;
  country?: string | null;
  source?: string | null;
  kind?: string | null;
  engagement?: LeadEngagement;
}

export interface LeadScoreResult {
  score: number;
  grade: LeadGrade;
  fit: LeadFit;
  /** The best-matching ICP segment, if the text identified one. */
  segmentId: string | null;
  segmentName: string | null;
  country: IcpCountry | null;
  /** Human-readable contributions, strongest first. */
  reasons: string[];
  /** Set when a disqualifier clamped the score. */
  disqualified: string | null;
}

/** Score bands. Deliberately conservative at the top: an A should be rare. */
export function gradeForScore(score: number): LeadGrade {
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "D";
}

const COUNTRY_PATTERNS: Array<[RegExp, IcpCountry]> = [
  [/\b(india|bharat|in)\b/i, "IN"],
  [/\b(australia|australian|aus|au)\b/i, "AU"],
];

/**
 * Reads a country from an explicit value, a ccTLD, or a phone prefix.
 *
 * Order matters: an explicit answer wins, then the email's domain, then the
 * phone. A `.com.au` address is stronger evidence than an ambiguous `+1`.
 */
export function inferLeadCountry(input: {
  country?: string | null;
  email?: string | null;
  phone?: string | null;
}): IcpCountry | null {
  const explicit = input.country?.trim();
  if (explicit) {
    const upper = explicit.toUpperCase();
    if (upper === "IN" || upper === "AU") return upper;
    for (const [pattern, code] of COUNTRY_PATTERNS) {
      if (pattern.test(explicit)) return code;
    }
  }

  const domain = input.email?.trim().toLowerCase().split("@").at(-1) ?? "";
  if (domain.endsWith(".in")) return "IN";
  if (domain.endsWith(".com.au") || domain.endsWith(".au")) return "AU";

  const phone = input.phone?.replace(/[\s()-]/g, "") ?? "";
  if (phone.startsWith("+61")) return "AU";
  if (phone.startsWith("+91")) return "IN";

  return null;
}

function normalizeText(input: LeadScoreInput): string {
  return [
    input.name,
    input.company,
    input.message,
    input.budget,
    input.timeline,
    input.source,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .toLowerCase();
}

/** Intent words that mean a live project rather than a browse. */
const INTENT_PHRASES = [
  "website",
  "web site",
  "redesign",
  "rebuild",
  "new site",
  "booking",
  "appointment",
  "online form",
  "intake form",
  "automation",
  "integrat",
  "chatbot",
  "ai assistant",
  "portal",
  "dashboard",
  "ecommerce",
  "e-commerce",
  "online store",
  "custom software",
  "quote",
  "proposal",
  "migrate",
  "seo",
  "performance",
  "maintenance",
];

const BUDGET_POINTS: Array<[RegExp, number, string]> = [
  // Ranges first: the broad "15 lakh" rule would otherwise swallow
  // "₹5 lakh – ₹15 lakh" and award the top band.
  [/(5\s*–\s*15|5\s*-\s*15|₹5 lakh\s*–\s*₹15)/i, 12, "Budget of ₹5–15 lakh"],
  [/(15\s*lakh|₹15|15 lakh\+)/i, 15, "Budget of ₹15 lakh or more"],
  [/(1\s*–\s*5|1\s*-\s*5|₹1 lakh\s*–\s*₹5)/i, 8, "Budget of ₹1–5 lakh"],
  [/(under\s*₹?1|below\s*₹?1|₹?1 lakh or less)/i, 3, "Small but real budget"],
];

const TIMELINE_POINTS: Array<[RegExp, number, string]> = [
  [
    /(as soon as possible|asap|immediately|this week|urgent)/i,
    10,
    "Wants to start now",
  ],
  [
    /(within 1 month|within a month|next month|this month|1 month)/i,
    8,
    "Starting within a month",
  ],
  [
    /(1\s*–\s*3|1\s*-\s*3|one to three|next quarter|q[1-4])/i,
    5,
    "Starting within one to three months",
  ],
  [
    /(3\s*–\s*6|3\s*-\s*6|three to six|six months)/i,
    2,
    "Longer planning horizon",
  ],
];

const SOURCE_POINTS: Record<string, [number, string]> = {
  referral: [8, "Came through a referral"],
  "website-contact": [4, "Direct website enquiry"],
  demo: [6, "Asked for a demo"],
  call: [4, "Requested a callback"],
  booking: [6, "Booked time directly"],
  consultant: [5, "Completed the project consultant"],
  "ai-consultant": [5, "Completed the project consultant"],
  audit: [3, "Requested a website audit"],
  "public-tool": [2, "Used a public tool"],
  chat: [3, "Engaged in website chat"],
  magnet: [2, "Downloaded a resource"],
  newsletter: [1, "Joined the newsletter"],
  form: [2, "Submitted an embedded form"],
  "embedded-form": [2, "Submitted an embedded form"],
  "prospect-conversion": [5, "Converted from qualified prospecting"],
};

function findMatches(text: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => text.includes(phrase));
}

function bestSegment(
  text: string,
): { segment: IcpSegment; matches: string[] } | null {
  return matchIcpSegment(text);
}

/**
 * Scores one lead.
 *
 * A disqualifier is a clamp rather than a subtraction. A competitor with a
 * large budget is still a competitor, and letting the budget signals drag a
 * disqualified lead back into the top half of the board would defeat the point.
 */
export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const reasons: string[] = [];
  const text = normalizeText(input);
  let score = 20;
  let disqualified: string | null = null;

  // ---- Country -----------------------------------------------------------
  const country = inferLeadCountry(input);
  if (country) {
    score += 15;
    reasons.push(`Based in ${country === "IN" ? "India" : "Australia"}`);
  } else {
    reasons.push("No confirmed India/Australia location");
  }

  // ---- Email quality -----------------------------------------------------
  const email = input.email?.trim() ?? "";
  if (email) {
    if (isFreeMailDomain(email)) {
      score -= 10;
      reasons.push("Free-mail address rather than a company domain");
    } else {
      score += 8;
      reasons.push("Business email on a company domain");
    }
  } else if (input.phone) {
    score += 3;
    reasons.push("Phone provided");
  }

  // ---- ICP segment -------------------------------------------------------
  const match = bestSegment(text);
  const segmentId = match?.segment.id ?? null;
  if (match) {
    const keywordPoints = Math.min(12, match.matches.length * 3);
    const weightPoints = Math.round(match.segment.weight * 8);
    score += keywordPoints + weightPoints;
    reasons.push(
      `Fits the ${match.segment.name} segment (+${keywordPoints + weightPoints})`,
    );
  } else {
    reasons.push("No clear ICP segment in the enquiry");
  }

  // ---- Intent ------------------------------------------------------------
  const intents = findMatches(text, INTENT_PHRASES);
  if (intents.length > 0) {
    const points = Math.min(10, intents.length * 2);
    score += points;
    reasons.push(`Described ${intents.slice(0, 2).join(" / ")} intent`);
  }

  // ---- Budget ------------------------------------------------------------
  for (const [pattern, points, reason] of BUDGET_POINTS) {
    if (pattern.test(input.budget ?? "")) {
      score += points;
      reasons.push(`${reason} (+${points})`);
      break;
    }
  }

  // ---- Timeline ----------------------------------------------------------
  for (const [pattern, points, reason] of TIMELINE_POINTS) {
    if (pattern.test(`${input.timeline ?? ""}\n${input.message ?? ""}`)) {
      score += points;
      reasons.push(`${reason} (+${points})`);
      break;
    }
  }

  // ---- Source ------------------------------------------------------------
  const sourceKey = input.source?.trim().toLowerCase() ?? "";
  const source = SOURCE_POINTS[sourceKey];
  if (source) {
    score += source[0];
    reasons.push(`${source[1]} (+${source[0]})`);
  }

  // ---- Profile completeness ---------------------------------------------
  if (input.company?.trim()) score += 2;
  if (input.phone?.trim()) score += 2;
  if ((input.name?.trim().length ?? 0) > 1) score += 1;
  const messageLength = input.message?.trim().length ?? 0;
  if (messageLength >= 160) {
    score += 3;
    reasons.push("Detailed brief");
  } else if (messageLength >= 60) {
    score += 1;
  }

  // ---- Engagement (bounded) ---------------------------------------------
  const opens = Math.min(4, Math.max(0, input.engagement?.opens ?? 0));
  const clicks = Math.min(3, Math.max(0, input.engagement?.clicks ?? 0));
  const replies = Math.min(1, Math.max(0, input.engagement?.replies ?? 0));
  if (opens > 0 || clicks > 0 || replies > 0) {
    const engagementPoints = opens + clicks * 2 + replies * 10;
    score += engagementPoints;
    reasons.push(
      `Engaged with email (${opens} open${opens === 1 ? "" : "s"}, ${clicks} click${clicks === 1 ? "" : "s"}${replies ? ", replied" : ""})`,
    );
  }

  // ---- Disqualifiers -----------------------------------------------------
  for (const rule of ICP_DISQUALIFIERS) {
    const hit = rule.keywords.find((keyword) => text.includes(keyword));
    if (hit) {
      disqualified = `${rule.label}: ${rule.reason}`;
      reasons.unshift(
        `Disqualified — ${rule.label.toLowerCase()}: ${rule.reason}`,
      );
      score = Math.min(score, 25);
      break;
    }
  }

  // A message that is just a job application is not a sales lead even if the
  // keyword list above missed the exact phrase.
  if (!disqualified && /\b(resume|cv|internship|job)\b/i.test(text)) {
    disqualified = "Job-seeker enquiry rather than a buying signal.";
    reasons.unshift("Disqualified — looks like a job application");
    score = Math.min(score, 25);
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeForScore(clamped);

  return {
    score: clamped,
    grade,
    fit:
      disqualified || !segmentId
        ? clamped >= 55
          ? "possible"
          : "poor"
        : clamped >= 60
          ? "strong"
          : "possible",
    segmentId,
    segmentName: match?.segment.name ?? null,
    country,
    reasons: reasons.slice(0, 8),
    disqualified,
  };
}

/** Convenience for UI filters and tests: the score's band, without recomputing. */
export function isHotLead(
  result: Pick<LeadScoreResult, "score" | "grade">,
): boolean {
  return result.grade === "A" || result.grade === "B";
}

/** Stage ordering used by the pipeline board. */
export const PIPELINE_STAGE_ORDER: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
];

/** All segments, exported so the scoring explanation can name a service. */
export { ICP_SEGMENTS, getIcpSegment };
