import "server-only";

import { z } from "zod";
import {
  AuditError,
  auditWebsiteWithPage,
  isSiteFailure,
} from "@/lib/server/website-auditor";
import { classifyProspect } from "@/lib/prospecting/classify";
import { extractSignals, unreachableSignals } from "@/lib/prospecting/signals";
import { describeOsmTags } from "@/lib/prospecting/categories";
import { normalizeEmail } from "@/lib/prospecting/normalize";
import {
  getProspect,
  markEnriching,
  markQualified,
  saveEnrichment,
} from "@/lib/server/prospecting/repository";
import { getSettingsFresh } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";
import type { ProspectSignals } from "@/lib/server/db/types";

/**
 * Enriches and classifies one prospect.
 *
 * The website fetch reuses the shared auditor rather than writing a second
 * fetcher. That matters for more than tidiness: it already pins DNS against an
 * SSRF allowlist, caps the body at 1 MB, bounds the time, follows at most three
 * redirects, and refuses non-HTML. A prospect's website URL comes from
 * crowd-sourced map data — exactly the attacker-influenced input those guards
 * exist for — so a fresh fetcher here would be a fresh SSRF hole.
 *
 * The subtle part is what a failed fetch *means*. "Your website is down" is the
 * most actionable thing you can tell a business owner, and also the easiest
 * thing to get wrong: a slow network on this end makes every large, healthy page
 * time out. So only DNS failure, a refused connection, a TLS failure, or a 5xx
 * counts as evidence about the prospect. Everything else is retried, and if it
 * still will not load, the prospect is recorded as *unchecked* rather than
 * labelled broken.
 */

const payloadSchema = z.object({ prospectId: z.string().min(1) });

/** Bound on how much HTML is scanned for a contact address. */
const EMAIL_HARVEST_SCAN_BYTES = 300_000;

/**
 * Enrichment runs in the background with nobody waiting, so it can afford far
 * longer than the public tool's 8s. A premature give-up here does not just lose
 * data — it produces a false "your website is down" claim.
 */
const ENRICH_TIMEOUT_MS = 30_000;

/**
 * How many attempts to spend on a failure that is not the prospect's fault
 * before recording the check as inconclusive.
 */
const UNKNOWN_RETRY_ATTEMPTS = 3;

export async function handleProspectEnrich(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Invalid enrichment payload.");

  const { prospectId } = parsed.data;
  const prospect = await getProspect(prospectId);
  if (!prospect) {
    // Deleted between enqueue and run. Nothing to do, and retrying will not
    // bring it back, so report success rather than burning attempts.
    context.log("Prospect no longer exists; nothing to enrich.");
    return { skipped: "missing" };
  }

  await markEnriching(prospectId);

  const categoryId = prospect.category
    ? describeOsmTags(parseCategoryTag(prospect.category)).categoryId
    : null;

  // No website: classification is already decided, and there is nothing to fetch.
  if (!prospect.website) {
    const classification = classifyProspect({
      hasWebsite: false,
      socialOnly: Boolean(prospect.socialUrl),
      signals: null,
      categoryId,
      hasEmail: Boolean(prospect.email),
      hasPhone: Boolean(prospect.phone),
    });

    await saveEnrichment(prospectId, {
      signals: null,
      classification,
      auditScore: null,
      websiteFinalUrl: null,
      error: null,
    });
    await markQualified(prospectId);

    context.log(
      prospect.socialUrl
        ? "No website; only a social page."
        : "No website found.",
    );
    return {
      primaryTag: classification.primaryTag,
      score: classification.score,
    };
  }

  let signals: ProspectSignals;
  let auditScore: number | null = null;
  let auditScores = null as {
    seo: number;
    performance: number;
    accessibility: number;
    security: number;
  } | null;
  let websiteFinalUrl: string | null = null;
  let harvestedEmail: string | null = null;
  let failureNote: string | null = null;

  try {
    const { result, page } = await auditWebsiteWithPage(prospect.website, {
      timeoutMs: ENRICH_TIMEOUT_MS,
    });
    websiteFinalUrl = result.finalUrl;
    auditScore = result.overallScore;
    auditScores = {
      seo: result.scores.seo,
      performance: result.scores.performance,
      accessibility: result.scores.accessibility,
      security: result.scores.security,
    };

    signals = extractSignals({
      html: page.html,
      // `IncomingHttpHeaders` is already lowercase-keyed by Node.
      headers: page.headers,
      finalUrl: page.finalUrl,
      responseTimeMs: page.responseTimeMs,
      htmlBytes: page.htmlBytes,
    });

    const { automation } = await getSettingsFresh();
    if (automation.harvestEmails && !prospect.email) {
      harvestedEmail = harvestEmail(page.html, page.finalUrl);
      if (harvestedEmail) context.log("Found a contact address on the site.");
    }

    context.log(
      `Audited ${result.finalUrl} — score ${result.overallScore}, ${result.responseTimeMs} ms.`,
    );
  } catch (error) {
    const reason =
      error instanceof AuditError ? error.reason : ("unknown" as const);
    failureNote =
      error instanceof Error ? error.message.slice(0, 300) : "Unreachable";

    // The distinction that keeps this feature honest.
    //
    // Only DNS failure, a refused connection, a TLS failure, or a 5xx is
    // evidence the *prospect's* site is broken. A timeout is evidence about
    // *our* network — on a slow link every large, perfectly healthy page times
    // out — and calling that "website down" means emailing a hospital to tell
    // them their working website is offline. That is worse than sending nothing.
    if (!isSiteFailure(reason)) {
      // Transient: let the queue retry with backoff before giving up.
      if (context.attempts < UNKNOWN_RETRY_ATTEMPTS) {
        context.log(
          `Could not reach the site (${reason}); retrying: ${failureNote}`,
        );
        throw error;
      }

      // Out of attempts. Record that the check failed and leave the prospect
      // unclassified rather than inventing a verdict: the admin list shows it
      // as "not checked yet", and no outreach can be built from it.
      context.log(
        `Giving up after ${context.attempts} attempts: ${failureNote}`,
      );
      await saveEnrichment(prospectId, {
        signals: null,
        classification: null,
        auditScore: null,
        websiteFinalUrl: null,
        error: `Could not check the website (${reason}): ${failureNote}`,
      });
      return { skipped: "unreachable-by-us", reason };
    }

    // Genuine evidence the site is broken.
    signals = unreachableSignals();
    context.log(`Site is genuinely unavailable (${reason}): ${failureNote}`);
  }

  const classification = classifyProspect({
    hasWebsite: true,
    socialOnly: false,
    signals,
    auditScore,
    auditScores,
    categoryId,
    hasEmail: Boolean(prospect.email ?? harvestedEmail),
    hasPhone: Boolean(prospect.phone),
  });

  await saveEnrichment(prospectId, {
    signals,
    classification,
    auditScore,
    websiteFinalUrl,
    email: harvestedEmail,
    emailSource: harvestedEmail ? "website" : undefined,
    error: failureNote,
  });
  await markQualified(prospectId);

  return {
    primaryTag: classification.primaryTag,
    score: classification.score,
    auditScore,
    reachable: signals.reachable,
    emailHarvested: Boolean(harvestedEmail),
  };
}

/** `amenity=restaurant` → the tag map `describeOsmTags` expects. */
function parseCategoryTag(raw: string): Record<string, string> {
  const [key, value] = raw.split("=");
  return key && value ? { [key]: value } : {};
}

/**
 * Pulls a business contact address out of the page.
 *
 * Only `mailto:` links are read — never free text — because scraping anything
 * that looks like an address off a page produces image filenames, tracking
 * pixels, and other people's addresses. Role addresses are preferred over
 * personal ones, and the agency/CMS addresses that appear in footer credits are
 * excluded: emailing the web designer instead of the business is worse than
 * sending nothing.
 */
export function harvestEmail(html: string, finalUrl: string): string | null {
  const scanned = html.slice(0, EMAIL_HARVEST_SCAN_BYTES);
  const found = new Set<string>();

  for (const match of scanned.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    const candidate = normalizeEmail(decodeURIComponent(match[1] ?? ""));
    if (candidate && !isExcludedEmail(candidate)) found.add(candidate);
  }

  if (found.size === 0) return null;
  const candidates = [...found];

  // Prefer an address on the site's own domain — that is the business, not a
  // third party linked from the page.
  let siteDomain = "";
  try {
    siteDomain = new URL(finalUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    siteDomain = "";
  }

  const sameDomain = candidates.filter((email) =>
    siteDomain ? email.endsWith(`@${siteDomain}`) : false,
  );
  const pool = sameDomain.length > 0 ? sameDomain : candidates;

  const rolePriority = [
    "info@",
    "hello@",
    "contact@",
    "enquiries@",
    "enquiry@",
    "sales@",
    "reservations@",
    "bookings@",
    "office@",
    "admin@",
  ];
  for (const prefix of rolePriority) {
    const match = pool.find((email) => email.startsWith(prefix));
    if (match) return match;
  }

  return pool[0] ?? null;
}

/**
 * Addresses that are never the business: platform and CMS boilerplate, the web
 * agency credited in the footer, and no-reply senders.
 */
const EXCLUDED_EMAIL_PATTERNS = [
  "noreply",
  "no-reply",
  "donotreply",
  "postmaster@",
  "abuse@",
  "@example.com",
  "@sentry.io",
  "@wordpress.com",
  "@wix.com",
  "@squarespace.com",
  "@shopify.com",
  "@godaddy.com",
  "@gmail.example",
  "webmaster@",
  "@localhost",
];

export function isExcludedEmail(email: string): boolean {
  return EXCLUDED_EMAIL_PATTERNS.some((pattern) => email.includes(pattern));
}
