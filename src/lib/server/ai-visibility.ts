import "server-only";

import {
  buildAiVisibilityResult,
  type AiVisibilityResult,
} from "@/lib/ai-visibility";
import { normalizeAuditUrl } from "@/lib/server/safe-url";
import {
  AuditError,
  fetchPublicText,
  type PublicResource,
} from "@/lib/server/website-auditor";

/**
 * AI visibility check.
 *
 * Three bounded requests run in parallel: the homepage, robots.txt, and
 * llms.txt. All go through the shared SSRF guard, redirect limit, response cap,
 * and timeout. A failing robots or llms request is treated as "absent", not as
 * a failure of the check; only the homepage is required.
 */

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_BODY_CHARS = 1_000_000;

interface Probe {
  checked: boolean;
  status: number;
  body: string;
}

function toProbe(resource: PublicResource | null): Probe {
  if (!resource) return { checked: false, status: 0, body: "" };
  // A 401, 403, or 429 on robots.txt usually means the edge is blocking
  // automated requests, so its absence is not evidence of permission. A 404
  // genuinely means "no rules".
  const checked =
    resource.statusCode < 400 ||
    resource.statusCode === 404 ||
    resource.statusCode === 410;
  return {
    checked,
    status: resource.statusCode,
    body: resource.body.slice(0, 200_000),
  };
}

export async function checkAiVisibility(
  input: string,
): Promise<AiVisibilityResult> {
  const normalized = normalizeAuditUrl(input);
  const origin = normalized.origin;

  const [homeResult, robotsResult, llmsResult] = await Promise.allSettled([
    fetchPublicText(normalized.toString(), {
      timeoutMs: REQUEST_TIMEOUT_MS,
      accept: "text/html,application/xhtml+xml;q=0.9",
    }),
    fetchPublicText(`${origin}/robots.txt`, {
      timeoutMs: REQUEST_TIMEOUT_MS,
    }),
    fetchPublicText(`${origin}/llms.txt`, {
      timeoutMs: REQUEST_TIMEOUT_MS,
    }),
  ]);

  if (homeResult.status === "rejected") {
    const error = homeResult.reason;
    throw error instanceof AuditError
      ? error
      : new AuditError("The website could not be reached.", "unknown");
  }

  const home = homeResult.value;
  if (home.statusCode >= 400) {
    throw new AuditError(
      home.statusCode >= 500
        ? `The website returned a server error (${home.statusCode}).`
        : `The website did not return its homepage (HTTP ${home.statusCode}). It may block automated checks.`,
      home.statusCode >= 500 ? "server-error" : "blocked",
      home.statusCode,
    );
  }

  const contentType = home.contentType.toLowerCase();
  const looksHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml") ||
    /<html[\s>]/i.test(home.body);
  if (!looksHtml) {
    throw new AuditError("The URL did not return an HTML webpage.", "not-html");
  }

  const robots =
    robotsResult.status === "fulfilled"
      ? toProbe(robotsResult.value)
      : toProbe(null);
  const llms =
    llmsResult.status === "fulfilled"
      ? toProbe(llmsResult.value)
      : toProbe(null);

  return buildAiVisibilityResult(normalized.toString(), {
    html: home.body.slice(0, MAX_BODY_CHARS),
    finalUrl: home.finalUrl,
    robots,
    llmsTxt: llms,
  });
}
