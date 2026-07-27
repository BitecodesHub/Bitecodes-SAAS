import type {
  ProspectClassification,
  ProspectSignals,
  ProspectTag,
} from "@/lib/server/db/types";

/**
 * Decides why a business is a prospect, and how good a prospect it is.
 *
 * This is the commercial core of outbound: it converts technical observations
 * into a single reason to make contact, a ranked set of talking points, and a
 * score that decides who gets emailed first. It is pure and fully deterministic
 * so the same business always yields the same pitch — an operator who sees a
 * classification and disagrees with it can read the rules rather than guess at
 * a model's mood.
 *
 * Two rules shape everything below:
 *
 * 1. **One primary reason.** A site can have eight problems; an opening email
 *    that lists eight problems is an insult, not a pitch. The most persuasive
 *    single fact wins and the rest become supporting detail.
 * 2. **Only verifiable claims.** Every issue string is something the owner can
 *    confirm in under a minute on their own phone. No invented traffic
 *    estimates, no invented revenue impact.
 */

export interface AuditCategoryScores {
  seo: number;
  performance: number;
  accessibility: number;
  security: number;
}

export interface ClassifyInput {
  /** A real website was found (a social page alone does not count). */
  hasWebsite: boolean;
  /** Only a Facebook page, link-in-bio, or free one-pager was found. */
  socialOnly?: boolean;
  signals: ProspectSignals | null;
  /** Overall 0-100 from the passive auditor, when it ran. */
  auditScore?: number | null;
  auditScores?: AuditCategoryScores | null;
  /** Catalogue vertical, which decides what features are expected. */
  categoryId?: string | null;
  hasEmail?: boolean;
  hasPhone?: boolean;
  /** Injected so tests are not tied to the calendar. */
  currentYear?: number;
}

/**
 * How compelling each reason is as the *opening line* of a cold email.
 *
 * Ordering is a sales judgement, not a technical one. "Your site is down" beats
 * "your site is slow" because one is an emergency and the other is an opinion;
 * "not usable on a phone" beats "missing meta descriptions" because the owner
 * can verify it instantly and feel it.
 */
const TAG_SEVERITY: Record<ProspectTag, number> = {
  "website-down": 100,
  "no-website": 95,
  "not-mobile-friendly": 85,
  "insecure-website": 75,
  "slow-website": 65,
  "seo-gaps": 55,
  "feature-upgrade": 45,
  "accessibility-gaps": 35,
  "strong-website": 0,
};

/** Base opportunity score per primary reason. */
const TAG_BASE_SCORE: Record<ProspectTag, number> = {
  "website-down": 92,
  "no-website": 88,
  "not-mobile-friendly": 82,
  "insecure-website": 76,
  "slow-website": 66,
  "seo-gaps": 58,
  "feature-upgrade": 52,
  "accessibility-gaps": 40,
  "strong-website": 12,
};

export const PROSPECT_TAG_LABELS: Record<ProspectTag, string> = {
  "no-website": "No website",
  "website-down": "Website down",
  "not-mobile-friendly": "Not mobile friendly",
  "slow-website": "Slow website",
  "insecure-website": "Insecure website",
  "seo-gaps": "SEO gaps",
  "accessibility-gaps": "Accessibility gaps",
  "feature-upgrade": "Feature upgrade",
  "strong-website": "Strong website",
};

/** Verticals where a single new client pays for a lot of outreach. */
const HIGH_VALUE_CATEGORIES = new Set([
  "professional-services",
  "real-estate",
  "health",
  "hospitality",
  "education",
  "automotive",
]);

/**
 * Platforms whose customers are locked into a template they cannot export.
 *
 * A concrete, non-insulting migration pitch — "you are paying rent on a site you
 * do not own" — so a site that is otherwise fine is still worth a conversation.
 */
const LOCKED_IN_PLATFORMS = new Set([
  "Wix",
  "GoDaddy Website Builder",
  "Weebly",
  "Blogger",
  "Carrd",
  "Squarespace",
]);

/**
 * What each vertical is expected to do online, and the words to use for it.
 *
 * `needs` names the signal that must be present; `missing` is the sentence used
 * when it is not. Written from the owner's point of view — "take table
 * reservations", never "implement a booking module".
 */
const VERTICAL_EXPECTATIONS: Record<
  string,
  Array<{ needs: keyof ProspectSignals; missing: string }>
> = {
  "food-drink": [
    { needs: "hasBooking", missing: "no way to reserve a table online" },
    {
      needs: "hasEcommerce",
      missing: "no online ordering or takeaway checkout",
    },
  ],
  health: [
    { needs: "hasBooking", missing: "no online appointment booking" },
    { needs: "hasContactForm", missing: "no patient enquiry form" },
  ],
  "beauty-wellness": [
    { needs: "hasBooking", missing: "no online appointment booking" },
  ],
  fitness: [
    { needs: "hasBooking", missing: "no class timetable or online sign-up" },
  ],
  hospitality: [
    {
      needs: "hasBooking",
      missing:
        "no direct booking, so every reservation pays a portal commission",
    },
  ],
  retail: [
    { needs: "hasEcommerce", missing: "no online store or click-and-collect" },
  ],
  "professional-services": [
    { needs: "hasContactForm", missing: "no enquiry form to capture leads" },
    { needs: "hasBlog", missing: "no articles to win search traffic" },
  ],
  education: [
    { needs: "hasContactForm", missing: "no enrolment or enquiry form" },
  ],
  events: [
    { needs: "hasContactForm", missing: "no enquiry form for event bookings" },
  ],
  "real-estate": [
    { needs: "hasContactForm", missing: "no enquiry form on listings" },
  ],
  automotive: [{ needs: "hasBooking", missing: "no online service booking" }],
  trades: [{ needs: "hasContactForm", missing: "no quote-request form" }],
};

interface Deficiency {
  tag: ProspectTag;
  issue: string;
  pitch: string;
}

/** Thresholds, named so the numbers are not scattered through the logic. */
const SLOW_RESPONSE_MS = 2_500;
const HEAVY_HTML_BYTES = 400_000;
const WEAK_CATEGORY_SCORE = 70;
const WEAK_SECURITY_SCORE = 60;
const STALE_YEARS = 4;

/**
 * Classifies one prospect.
 *
 * Never throws and never returns null: every business gets a classification,
 * because a prospect with no classification would silently vanish from the
 * pipeline. When there is genuinely nothing wrong, that is itself the answer
 * (`strong-website`, deprioritised by score).
 */
export function classifyProspect(input: ClassifyInput): ProspectClassification {
  const {
    hasWebsite,
    socialOnly = false,
    signals,
    auditScores = null,
    categoryId = null,
    hasEmail = false,
    hasPhone = false,
    currentYear = new Date().getUTCFullYear(),
  } = input;

  const deficiencies = collectDeficiencies({
    hasWebsite,
    socialOnly,
    signals,
    auditScores,
    categoryId,
  });

  const primary = pickPrimary(deficiencies);
  const tags = orderTags(deficiencies, primary);

  const score = computeScore({
    primary,
    deficiencyCount: deficiencies.length,
    hasEmail,
    hasPhone,
    categoryId,
    signals,
    socialOnly,
    currentYear,
  });

  // The primary reason leads; supporting detail follows in severity order.
  const ordered = [
    ...deficiencies.filter((entry) => entry.tag === primary),
    ...deficiencies.filter((entry) => entry.tag !== primary),
  ];

  return {
    primaryTag: primary,
    tags,
    score,
    pitchAngles: dedupeStrings(ordered.map((entry) => entry.pitch)).slice(0, 5),
    topIssues: dedupeStrings(ordered.map((entry) => entry.issue)).slice(0, 5),
  };
}

function collectDeficiencies({
  hasWebsite,
  socialOnly,
  signals,
  auditScores,
  categoryId,
}: {
  hasWebsite: boolean;
  socialOnly: boolean;
  signals: ProspectSignals | null;
  auditScores: AuditCategoryScores | null;
  categoryId: string | null;
}): Deficiency[] {
  const found: Deficiency[] = [];

  if (!hasWebsite) {
    found.push(
      socialOnly
        ? {
            tag: "no-website",
            issue: "Only a social page, no website",
            pitch:
              "The business is discoverable only inside a social platform it does not control — no domain, no search presence, and no way to own the customer relationship.",
          }
        : {
            tag: "no-website",
            issue: "No website found",
            pitch:
              "No website at all: every search for this business today sends the customer to a competitor that has one.",
          },
    );
    return found;
  }

  // A website exists but enrichment could not load it.
  if (!signals || !signals.reachable) {
    found.push({
      tag: "website-down",
      issue: "Website did not load",
      pitch:
        "The website did not respond when checked. Anyone searching for the business right now sees an error page, and the owner may not know.",
    });
    return found;
  }

  if (!signals.responsive) {
    found.push({
      tag: "not-mobile-friendly",
      issue: "Not usable on a phone",
      pitch:
        "The site declares no mobile layout, so it renders as a shrunken desktop page. Most local searches happen on a phone, and this is visible to the owner in five seconds on their own device.",
    });
  }

  if (!signals.https) {
    found.push({
      tag: "insecure-website",
      issue: "No HTTPS — browsers show “Not secure”",
      pitch:
        "The site is served over an unencrypted connection, so Chrome and Safari label it “Not secure” in the address bar. It is a trust problem before it is a technical one.",
    });
  } else if (auditScores && auditScores.security < WEAK_SECURITY_SCORE) {
    found.push({
      tag: "insecure-website",
      issue: "Missing basic security headers",
      pitch:
        "HTTPS is in place but the defensive response headers are not, leaving the site more exposed to content injection than it needs to be.",
    });
  }

  const responseTime = signals.responseTimeMs;
  const bytes = signals.htmlBytes;
  if (
    (typeof responseTime === "number" && responseTime > SLOW_RESPONSE_MS) ||
    (typeof bytes === "number" && bytes > HEAVY_HTML_BYTES) ||
    (auditScores && auditScores.performance < WEAK_CATEGORY_SCORE)
  ) {
    found.push({
      tag: "slow-website",
      issue: describeSlowness(responseTime, bytes),
      pitch:
        "The page is slow enough to lose visitors before it paints. Speed is the one improvement that raises both search ranking and conversion at the same time.",
    });
  }

  const seoGaps: string[] = [];
  if (!signals.hasStructuredData) seoGaps.push("no structured data");
  if (!signals.hasOpenGraph) seoGaps.push("no social preview tags");
  if (auditScores && auditScores.seo < WEAK_CATEGORY_SCORE) {
    seoGaps.push("weak page metadata");
  }
  if (seoGaps.length >= 2) {
    found.push({
      tag: "seo-gaps",
      issue: `Search and sharing gaps: ${seoGaps.join(", ")}`,
      pitch:
        "The page is missing the markup search engines and social platforms read, so it neither earns rich results nor previews properly when someone shares it.",
    });
  }

  if (auditScores && auditScores.accessibility < WEAK_CATEGORY_SCORE) {
    found.push({
      tag: "accessibility-gaps",
      issue: "Accessibility problems in the markup",
      pitch:
        "Headings, landmarks, or image alternatives are missing, which shuts out assistive technology and, in several markets, carries real legal exposure.",
    });
  }

  const featureGaps = findFeatureGaps(signals, categoryId);
  if (featureGaps.length > 0) {
    found.push({
      tag: "feature-upgrade",
      issue: `Missing capability: ${featureGaps.join("; ")}`,
      pitch: `The site works but does not sell: ${featureGaps.join("; ")}. Each of these turns an existing visitor into revenue without buying more traffic.`,
    });
  }

  if (found.length === 0) {
    found.push({
      tag: "strong-website",
      issue: "No obvious problems found",
      pitch:
        "The site is in good shape. Worth a conversation about what comes next rather than what is broken — integrations, automation, or an internal tool.",
    });
  }

  return found;
}

function describeSlowness(
  responseTimeMs: number | null,
  htmlBytes: number | null,
): string {
  if (typeof responseTimeMs === "number" && responseTimeMs > SLOW_RESPONSE_MS) {
    return `Slow to respond (${(responseTimeMs / 1000).toFixed(1)}s to first byte)`;
  }
  if (typeof htmlBytes === "number" && htmlBytes > HEAVY_HTML_BYTES) {
    return `Very heavy page (${Math.round(htmlBytes / 1024)} KB of HTML)`;
  }
  return "Slow page load";
}

/**
 * Features the vertical is expected to have, plus two that every business
 * benefits from. Capped at three so the pitch stays a pitch.
 */
function findFeatureGaps(
  signals: ProspectSignals,
  categoryId: string | null,
): string[] {
  const gaps: string[] = [];

  const expectations = categoryId
    ? VERTICAL_EXPECTATIONS[categoryId]
    : undefined;
  for (const expectation of expectations ?? []) {
    if (!signals[expectation.needs]) gaps.push(expectation.missing);
  }

  // Universal, and only worth mentioning once the vertical-specific gaps are in.
  if (!signals.hasContactForm && !gaps.some((gap) => gap.includes("form"))) {
    gaps.push("no contact form, so every enquiry depends on a phone call");
  }
  if (!signals.hasAnalytics) {
    gaps.push("no analytics, so nobody knows what the site is doing");
  }

  return gaps.slice(0, 3);
}

/** The most severe reason present; ties resolve to the first found. */
function pickPrimary(deficiencies: readonly Deficiency[]): ProspectTag {
  let primary: ProspectTag = "strong-website";
  let best = -1;

  for (const entry of deficiencies) {
    const severity = TAG_SEVERITY[entry.tag];
    if (severity > best) {
      best = severity;
      primary = entry.tag;
    }
  }

  return primary;
}

/** Primary first, then remaining tags by descending severity, de-duplicated. */
function orderTags(
  deficiencies: readonly Deficiency[],
  primary: ProspectTag,
): ProspectTag[] {
  const unique = [...new Set(deficiencies.map((entry) => entry.tag))];
  return [
    primary,
    ...unique
      .filter((tag) => tag !== primary)
      .sort((a, b) => TAG_SEVERITY[b] - TAG_SEVERITY[a]),
  ];
}

function computeScore({
  primary,
  deficiencyCount,
  hasEmail,
  hasPhone,
  categoryId,
  signals,
  socialOnly,
  currentYear,
}: {
  primary: ProspectTag;
  deficiencyCount: number;
  hasEmail: boolean;
  hasPhone: boolean;
  categoryId: string | null;
  signals: ProspectSignals | null;
  socialOnly: boolean;
  currentYear: number;
}): number {
  let score = TAG_BASE_SCORE[primary];

  // Reachability is worth more than any single defect: a perfect prospect with
  // no way to contact them is not a prospect.
  if (hasEmail) score += 6;
  if (hasPhone) score += 3;
  if (!hasEmail && !hasPhone) score -= 10;

  if (categoryId && HIGH_VALUE_CATEGORIES.has(categoryId)) score += 4;

  // Compounding problems make the case easier to argue, with a ceiling so a
  // long defect list cannot outweigh the primary reason.
  score += Math.min(6, Math.max(0, deficiencyCount - 1) * 2);

  if (signals?.platform && LOCKED_IN_PLATFORMS.has(signals.platform)) {
    score += 4;
  }

  if (
    typeof signals?.copyrightYear === "number" &&
    signals.copyrightYear <= currentYear - STALE_YEARS
  ) {
    score += 5;
  }

  // A business that chose a free social page has demonstrated low willingness to
  // spend. Still a prospect, just not first in the queue.
  if (socialOnly) score -= 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

/** Highest-scoring first, so the send queue drains in value order. */
export function compareByOpportunity(
  a: ProspectClassification,
  b: ProspectClassification,
): number {
  if (b.score !== a.score) return b.score - a.score;
  return TAG_SEVERITY[b.primaryTag] - TAG_SEVERITY[a.primaryTag];
}
