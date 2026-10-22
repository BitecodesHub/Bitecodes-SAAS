import { z } from "zod";

/**
 * AI visibility ("GEO") scoring.
 *
 * Checks the public signals an answer engine or AI crawler can actually read:
 * crawler permissions, an llms.txt summary, structured data, answer-shaped
 * headings, metadata, and social preview. Every check is derived from the
 * initial response, so the result is reproducible and never claims to know how
 * a specific model ranks a page.
 *
 * Pure functions live here so the scoring is testable without a network call.
 */

export const aiVisibilityInputSchema = z
  .object({
    url: z.string().trim().min(3).max(500),
  })
  .strict();

/** Crawlers that feed AI answers, search assistants, or AI training indexes. */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
] as const;

export type AiVisibilityCheckId =
  | "crawlerAccess"
  | "llmsTxt"
  | "structuredData"
  | "answerStructure"
  | "metadata"
  | "socialPreview"
  | "https";

export type CheckStatus = "pass" | "warning" | "fail";

export interface AiVisibilityCheck {
  id: AiVisibilityCheckId;
  label: string;
  status: CheckStatus;
  earned: number;
  max: number;
  detail: string;
  recommendation: string;
}

export interface CrawlerRuleResult {
  name: string;
  allowed: boolean;
  /** The directive that decided it, e.g. `Disallow: /`. */
  reason: string;
}

export interface AiVisibilityResult {
  auditedUrl: string;
  finalUrl: string;
  auditedAt: string;
  score: number;
  grade: "strong" | "fair" | "weak";
  checks: AiVisibilityCheck[];
  crawlers: CrawlerRuleResult[];
  priorityFixes: { title: string; detail: string }[];
  scope: string;
}

export type AiVisibilityResponse =
  | { ok: true; result: AiVisibilityResult }
  | {
      ok: false;
      code: "INVALID" | "BLOCKED" | "RATE_LIMITED" | "UNAVAILABLE";
      message: string;
    };

export const AI_FOLLOW_UP_CONSENT_TEXT =
  "I agree that Bitecodes may contact me about the AI visibility report and how to improve it.";

/**
 * Payload accepted by the report-email route. It intentionally carries no
 * score or findings: the route re-runs the scan so an email can never be used
 * to relay browser-supplied claims about someone else's site.
 */
export const aiVisibilityEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().max(100).optional(),
    url: z.string().trim().min(3).max(500),
    followUp: z.boolean().default(false),
    attribution: z.unknown().optional(),
    requestId: z.string().trim().min(8).max(64).optional(),
  })
  .strict();

export type AiVisibilityEmailInput = z.input<typeof aiVisibilityEmailSchema>;

export const CHECK_WEIGHTS: Record<AiVisibilityCheckId, number> = {
  crawlerAccess: 25,
  structuredData: 20,
  metadata: 15,
  answerStructure: 15,
  llmsTxt: 10,
  https: 10,
  socialPreview: 5,
};

export function gradeFor(score: number): AiVisibilityResult["grade"] {
  if (score >= 80) return "strong";
  if (score >= 55) return "fair";
  return "weak";
}

export function sumScore(checks: AiVisibilityCheck[]) {
  return Math.max(
    0,
    Math.min(100, Math.round(checks.reduce((total, c) => total + c.earned, 0))),
  );
}

export function priorityFixes(checks: AiVisibilityCheck[]) {
  return checks
    .filter((check) => check.earned < check.max)
    .sort((a, b) => b.max - b.earned - (a.max - a.earned))
    .slice(0, 3)
    .map((check) => ({
      title: `${check.label} — ${check.max - check.earned} points available`,
      detail: check.recommendation,
    }));
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

export interface RobotsRule {
  allow: boolean;
  path: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

/** Parses the subset of robots.txt that decides whether `/` is crawlable. */
export function parseRobots(body: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let lastWasAgent = false;

  const flush = () => {
    if (agents.length && rules.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!lastWasAgent) {
        flush();
      }
      agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (key === "allow" || key === "disallow") {
      if (agents.length === 0) continue;
      rules.push({ allow: key === "allow", path: value });
    }
  }

  flush();
  return groups;
}

/**
 * Decides whether a bot may fetch `/`.
 *
 * Follows the common convention: exact user-agent groups take precedence over
 * `*`, and the longest matching path wins, with `Allow` winning a tie.
 */
export function crawlerRule(
  bot: string,
  groups: RobotsGroup[],
): { allowed: boolean; reason: string } {
  const name = bot.toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && name.includes(agent)),
  );
  const wildcard = groups.filter((group) => group.agents.includes("*"));
  const applicable = specific.length > 0 ? specific : wildcard;

  if (applicable.length === 0) {
    return { allowed: true, reason: "No matching robots.txt group" };
  }

  const rules = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path.startsWith("/"))
    .sort(
      (a, b) =>
        b.path.length - a.path.length || Number(b.allow) - Number(a.allow),
    );

  const matched = rules.find((rule) => rule.path === "/");
  if (!matched) {
    return { allowed: true, reason: "No rule blocks the homepage" };
  }
  return {
    allowed: matched.allow,
    reason: `${matched.allow ? "Allow" : "Disallow"}: ${matched.path}`,
  };
}

// ---------------------------------------------------------------------------
// HTML extraction
// ---------------------------------------------------------------------------

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
  )) {
    const [, key, doubleQuoted, singleQuoted, bare] = match;
    result[key.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bare ?? "";
  }
  return result;
}

export function extractHead(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]) : "";

  const metas: Record<string, string> = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.name ?? attrs.property ?? "").toLowerCase();
    if (key && attrs.content) {
      // First occurrence wins, matching how crawlers read duplicate tags.
      if (!(key in metas)) metas[key] = decodeEntities(attrs.content);
    }
  }

  let canonical = "";
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (
      (attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") &&
      attrs.href
    ) {
      canonical = decodeEntities(attrs.href);
      break;
    }
  }

  return {
    title,
    description: metas.description ?? "",
    canonical,
    ogTitle: metas["og:title"] ?? "",
    ogDescription: metas["og:description"] ?? "",
    ogImage: metas["og:image"] ?? "",
    robots: metas.robots ?? "",
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    h2Count: (html.match(/<h2\b/gi) ?? []).length,
  };
}

export function extractStructuredData(html: string) {
  const blocks: unknown[] = [];
  let scripts = 0;
  let invalid = 0;

  for (const match of html.matchAll(
    /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    scripts += 1;
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object") blocks.push(parsed);
    } catch {
      invalid += 1;
    }
  }

  const types = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    if (typeof type === "string") types.add(type);
    if (Array.isArray(type)) {
      type.forEach((value) => typeof value === "string" && types.add(value));
    }
    if (record["@graph"]) visit(record["@graph"]);
    if (record.mainEntity) visit(record.mainEntity);
    if (record.itemListElement) visit(record.itemListElement);
  };
  blocks.forEach(visit);

  return { scripts, invalid, blocks: blocks.length, types: [...types] };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface AiVisibilitySignals {
  html: string;
  finalUrl: string;
  robots: { status: number; body: string; checked: boolean };
  llmsTxt: { status: number; body: string; checked: boolean };
}

function check(
  id: AiVisibilityCheckId,
  status: CheckStatus,
  earned: number,
  detail: string,
  recommendation: string,
): AiVisibilityCheck {
  return {
    id,
    label: CHECK_LABELS[id],
    status,
    earned,
    max: CHECK_WEIGHTS[id],
    detail,
    recommendation,
  };
}

const CHECK_LABELS: Record<AiVisibilityCheckId, string> = {
  crawlerAccess: "AI crawler access",
  structuredData: "Structured data",
  metadata: "Page metadata",
  answerStructure: "Answer structure",
  llmsTxt: "llms.txt summary",
  https: "Secure delivery",
  socialPreview: "Social preview",
};

export function scoreAiVisibility(
  signals: AiVisibilitySignals,
): Omit<AiVisibilityResult, "auditedUrl" | "auditedAt"> {
  const head = extractHead(signals.html);
  const structured = extractStructuredData(signals.html);
  const checks: AiVisibilityCheck[] = [];

  // 1. Crawler access -------------------------------------------------------
  const groups = parseRobots(signals.robots.body);
  const crawlers: CrawlerRuleResult[] = AI_CRAWLERS.map((bot) => {
    const decision = crawlerRule(bot, groups);
    return { name: bot, allowed: decision.allowed, reason: decision.reason };
  });
  const allowedCount = crawlers.filter((crawler) => crawler.allowed).length;
  const noindex =
    /(^|,)\s*noindex\b/i.test(head.robots) || /noindex/i.test(head.robots);
  const crawlerMax = CHECK_WEIGHTS.crawlerAccess;

  if (!signals.robots.checked) {
    checks.push(
      check(
        "crawlerAccess",
        "warning",
        Math.round(crawlerMax * 0.6),
        "robots.txt could not be checked for this site.",
        "Publish a robots.txt that allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, and Google-Extended.",
      ),
    );
  } else if (noindex) {
    checks.push(
      check(
        "crawlerAccess",
        "fail",
        0,
        "The homepage asks crawlers not to index it (a noindex directive).",
        "Remove the noindex directive from public, indexable pages.",
      ),
    );
  } else if (allowedCount === AI_CRAWLERS.length) {
    checks.push(
      check(
        "crawlerAccess",
        "pass",
        crawlerMax,
        `All ${AI_CRAWLERS.length} major AI and search crawlers may fetch the homepage.`,
        "Keep robots.txt permissive for the crawlers you want to cite you.",
      ),
    );
  } else {
    const blocked = crawlers.filter((crawler) => !crawler.allowed);
    const earned = Math.round((crawlerMax * allowedCount) / AI_CRAWLERS.length);
    checks.push(
      check(
        "crawlerAccess",
        blocked.length > AI_CRAWLERS.length / 2 ? "fail" : "warning",
        earned,
        `${blocked.length} of ${AI_CRAWLERS.length} crawlers are disallowed: ${blocked
          .map((crawler) => crawler.name)
          .join(", ")}.`,
        `Allow the crawlers you want to cite you (currently blocked: ${blocked
          .map((crawler) => crawler.name)
          .join(", ")}).`,
      ),
    );
  }

  // 2. llms.txt -------------------------------------------------------------
  const llms = signals.llmsTxt;
  const llmsBody = llms.body.trim();
  if (llms.checked && llms.status === 200 && llmsBody.length >= 20) {
    checks.push(
      check(
        "llmsTxt",
        "pass",
        CHECK_WEIGHTS.llmsTxt,
        "An llms.txt summary is published and readable.",
        "Keep the summary factual and regenerate it when products or prices change.",
      ),
    );
  } else {
    checks.push(
      check(
        "llmsTxt",
        "fail",
        0,
        llms.checked
          ? `No usable llms.txt was found (HTTP ${llms.status || "error"}).`
          : "llms.txt could not be checked.",
        "Publish a concise /llms.txt with the company, services, prices, and key page links so AI crawlers get a clean summary.",
      ),
    );
  }

  // 3. Structured data ------------------------------------------------------
  if (structured.blocks > 0) {
    checks.push(
      check(
        "structuredData",
        "pass",
        CHECK_WEIGHTS.structuredData,
        `Valid JSON-LD found (${structured.types.slice(0, 6).join(", ") || "no @type"}).`,
        "Keep structured data aligned with the visible page and include FAQPage or Service where relevant.",
      ),
    );
  } else if (structured.scripts > 0) {
    checks.push(
      check(
        "structuredData",
        "fail",
        5,
        `${structured.invalid} JSON-LD block(s) could not be parsed.`,
        "Fix the JSON-LD syntax so crawlers can read the entity types.",
      ),
    );
  } else {
    checks.push(
      check(
        "structuredData",
        "fail",
        0,
        "No JSON-LD structured data was found in the initial HTML.",
        "Add Organization, WebSite, Service, and FAQPage JSON-LD so answer engines can identify the business and its offers.",
      ),
    );
  }

  // 4. Answer structure -----------------------------------------------------
  if (head.h1Count === 0) {
    checks.push(
      check(
        "answerStructure",
        "fail",
        0,
        "No H1 heading was found in the initial HTML.",
        "Lead with one clear H1 that states the page's subject, then use H2 question headings.",
      ),
    );
  } else if (head.h1Count === 1 && head.h2Count >= 3) {
    checks.push(
      check(
        "answerStructure",
        "pass",
        CHECK_WEIGHTS.answerStructure,
        `One H1 and ${head.h2Count} H2 sections give the page a clear outline.`,
        "Keep headings descriptive and answer the question in the first sentence under each one.",
      ),
    );
  } else {
    checks.push(
      check(
        "answerStructure",
        "warning",
        Math.round(CHECK_WEIGHTS.answerStructure * 0.65),
        `${head.h1Count} H1 and ${head.h2Count} H2 heading(s) detected.`,
        "Use exactly one H1 and several H2 sections phrased as the questions buyers ask.",
      ),
    );
  }

  // 5. Metadata -------------------------------------------------------------
  const titleScore =
    head.title.length >= 10 && head.title.length <= 70 ? 5 : head.title ? 2 : 0;
  const descriptionScore =
    head.description.length >= 50 && head.description.length <= 180
      ? 5
      : head.description
        ? 2
        : 0;
  const canonicalScore = head.canonical ? 5 : 0;
  const metadataScore = titleScore + descriptionScore + canonicalScore;
  checks.push(
    check(
      "metadata",
      metadataScore >= 13 ? "pass" : metadataScore >= 7 ? "warning" : "fail",
      metadataScore,
      [
        head.title ? `Title: ${head.title.length} characters.` : "No title.",
        head.description
          ? `Description: ${head.description.length} characters.`
          : "No meta description.",
        head.canonical ? "Canonical link present." : "No canonical link.",
      ].join(" "),
      "Write a 10–70 character title, a 50–180 character description, and an absolute canonical URL.",
    ),
  );

  // 6. Social preview -------------------------------------------------------
  const socialPresent = [head.ogTitle, head.ogDescription, head.ogImage].filter(
    Boolean,
  ).length;
  checks.push(
    check(
      "socialPreview",
      socialPresent === 3 ? "pass" : socialPresent > 0 ? "warning" : "fail",
      Math.round((CHECK_WEIGHTS.socialPreview * socialPresent) / 3),
      `Open Graph tags present: ${socialPresent} of 3 (title, description, image).`,
      "Add og:title, og:description, and an absolute og:image so links render well when shared or cited.",
    ),
  );

  // 7. HTTPS ----------------------------------------------------------------
  const secure = signals.finalUrl.startsWith("https://");
  checks.push(
    check(
      "https",
      secure ? "pass" : "fail",
      secure ? CHECK_WEIGHTS.https : 0,
      secure
        ? "The final page loads over HTTPS."
        : "The final page loads over unencrypted HTTP.",
      "Redirect all traffic to HTTPS and keep a valid TLS certificate.",
    ),
  );

  const score = sumScore(checks);
  return {
    finalUrl: signals.finalUrl,
    score,
    grade: gradeFor(score),
    checks,
    crawlers,
    priorityFixes: priorityFixes(checks),
    scope:
      "Based on one public homepage response, robots.txt, and llms.txt at the time of checking. This measures discoverability signals, not how any specific AI model ranks or cites the page.",
  };
}

/** Builds the user-facing result from validated signal inputs. */
export function buildAiVisibilityResult(
  auditedUrl: string,
  signals: AiVisibilitySignals,
  auditedAt = new Date().toISOString(),
): AiVisibilityResult {
  return { auditedUrl, auditedAt, ...scoreAiVisibility(signals) };
}
