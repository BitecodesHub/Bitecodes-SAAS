import type { ProspectSignals, ProspectTag } from "@/lib/server/db/types";

/**
 * Turns a prospect's classification into the sections of their public report.
 *
 * Pure, so the wording a business owner reads is unit-tested rather than
 * assembled inline in a page component.
 *
 * The tone is set deliberately. This page is the first thing a stranger sees
 * from Bitecodes, and it is about *their* website's shortcomings — so every
 * item states an observation, why it matters commercially, and what fixing it
 * involves. No scores out of ten dressed up as failure, no invented traffic
 * losses, no urgency that is not real. A report that overclaims is worse than
 * no report: it is checkable in thirty seconds, and being caught exaggerating
 * ends the conversation.
 */

export interface ReportItem {
  /** What was observed. */
  title: string;
  /** Why it matters to the business, in their terms. */
  why: string;
  /** What putting it right involves. */
  fix: string;
  severity: "high" | "medium" | "low";
}

/** Findings keyed by tag, so one list drives both the report and the email. */
const TAG_REPORT: Record<ProspectTag, ReportItem> = {
  "no-website": {
    title: "No website found",
    why: "When somebody searches for you and finds nothing, they call the next business on the list. A single page with your hours, location, and a way to get in touch captures that call instead.",
    fix: "A focused one-page site with your details, photos, and a contact form. Days rather than weeks.",
    severity: "high",
  },
  "website-down": {
    title: "Your website did not load when we checked",
    why: "Anyone searching for you right now sees an error page. Outages often go unnoticed for weeks because the owner rarely visits their own site.",
    fix: "Confirm the hosting and domain are current, then add uptime monitoring so the next outage sends you a message within a minute.",
    severity: "high",
  },
  "not-mobile-friendly": {
    title: "The site is not built for phones",
    why: "Most local searches happen on a phone. Without a mobile layout the page loads zoomed out, text is unreadable, and buttons are hard to hit — you can see it yourself on your own phone in five seconds.",
    fix: "A responsive rebuild of the existing design, so one site works on every screen size.",
    severity: "high",
  },
  "insecure-website": {
    title: "Browsers mark your site “Not secure”",
    why: "Without a valid certificate, Chrome and Safari show a warning beside your address. Visitors read that as “this business is not careful”, and search engines rank it lower.",
    fix: "Install a certificate and redirect all traffic to the secure address. Usually an afternoon, and the certificate itself is free.",
    severity: "high",
  },
  "slow-website": {
    title: "The page is slow to load",
    why: "Visitors leave pages that take more than a few seconds, and speed is one of the factors search engines measure directly. It is the one improvement that helps ranking and conversion at the same time.",
    fix: "Compress images, cut unused scripts, and serve the site from a cache close to your customers.",
    severity: "medium",
  },
  "seo-gaps": {
    title: "Search engines cannot read the page properly",
    why: "The markup that tells Google what your business is, where it is, and when it is open is missing — so you are less likely to appear in the map results, and links to your site preview as a bare URL when shared.",
    fix: "Add structured business data, page titles and descriptions, and social preview tags.",
    severity: "medium",
  },
  "accessibility-gaps": {
    title: "Parts of the site are unusable with assistive technology",
    why: "Headings, landmarks, or image descriptions are missing, which shuts out visitors using a screen reader and, in several markets, carries legal exposure.",
    fix: "Correct the heading structure, label images and controls, and check contrast. Largely a markup change, not a redesign.",
    severity: "medium",
  },
  "feature-upgrade": {
    title: "The site informs but does not sell",
    why: "It tells people about the business but does not let them act — book, order, enquire, or pay. Every visitor who has to phone instead is one you can lose to a competitor who does not make them.",
    fix: "Add the one action that matters most for your business, then measure it.",
    severity: "medium",
  },
  "strong-website": {
    title: "Your website is in good shape",
    why: "Nothing here needs urgent attention. The next gains come from what the site does rather than how it is built — integrations, automation, or tools for your team.",
    fix: "Worth a conversation about what would save you the most time.",
    severity: "low",
  },
};

export function reportItemForTag(tag: ProspectTag): ReportItem {
  return TAG_REPORT[tag];
}

/**
 * Builds the ordered report body.
 *
 * Capped at four items. A list of nine problems reads as an attack and gets
 * closed; the strongest few get read and answered.
 */
export function buildReportItems(
  tags: readonly ProspectTag[],
  limit = 4,
): ReportItem[] {
  const seen = new Set<ProspectTag>();
  const items: ReportItem[] = [];

  for (const tag of tags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    items.push(TAG_REPORT[tag]);
    if (items.length >= limit) break;
  }

  return items;
}

/** Facts observed during the check, for the "what we looked at" panel. */
export interface ReportObservation {
  label: string;
  value: string;
  ok: boolean | null;
}

export function buildObservations(
  signals: ProspectSignals | null,
): ReportObservation[] {
  if (!signals || !signals.reachable) return [];

  const yesNo = (value: boolean) => (value ? "Yes" : "No");

  const observations: ReportObservation[] = [
    {
      label: "Secure connection (HTTPS)",
      value: yesNo(signals.https),
      ok: signals.https,
    },
    {
      label: "Mobile layout declared",
      value: yesNo(signals.responsive),
      ok: signals.responsive,
    },
    {
      label: "Business data for search engines",
      value: yesNo(signals.hasStructuredData),
      ok: signals.hasStructuredData,
    },
    {
      label: "Social sharing preview",
      value: yesNo(signals.hasOpenGraph),
      ok: signals.hasOpenGraph,
    },
    {
      label: "Way to get in touch on the page",
      value: yesNo(signals.hasContactForm),
      ok: signals.hasContactForm,
    },
    {
      label: "Visitor analytics",
      value: yesNo(signals.hasAnalytics),
      ok: signals.hasAnalytics,
    },
  ];

  if (typeof signals.responseTimeMs === "number") {
    observations.push({
      label: "Time to first response",
      value: `${(signals.responseTimeMs / 1000).toFixed(2)}s`,
      ok: signals.responseTimeMs <= 1_500,
    });
  }

  if (typeof signals.htmlBytes === "number") {
    observations.push({
      label: "Page size",
      value: `${Math.max(1, Math.round(signals.htmlBytes / 1024))} KB`,
      ok: signals.htmlBytes <= 250_000,
    });
  }

  if (signals.platform) {
    observations.push({
      label: "Built with",
      value: signals.platform,
      ok: null,
    });
  }

  if (typeof signals.copyrightYear === "number") {
    observations.push({
      label: "Footer copyright year",
      value: String(signals.copyrightYear),
      ok: null,
    });
  }

  return observations;
}

/**
 * One sentence summarising the check, used as the report's lead.
 *
 * Names the business and states the single most important finding. Anything
 * longer gets skimmed past.
 */
export function reportHeadline(
  businessName: string,
  primaryTag: ProspectTag,
): string {
  switch (primaryTag) {
    case "no-website":
      return `We could not find a website for ${businessName}.`;
    case "website-down":
      return `${businessName}'s website did not load when we checked it.`;
    case "strong-website":
      return `${businessName}'s website holds up well.`;
    default:
      return `We looked at ${businessName}'s website and found a few things worth fixing.`;
  }
}
