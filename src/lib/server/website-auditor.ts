import "server-only";

import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { performance } from "node:perf_hooks";
import type { IncomingHttpHeaders } from "node:http";
import type { Readable } from "node:stream";
import {
  calculateAuditScores,
  type AuditFinding,
  type WebsiteAuditResult,
} from "@/lib/website-audit";
import {
  DnsResolutionError,
  assertPublicAuditUrl,
  normalizeAuditUrl,
} from "@/lib/server/safe-url";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1_000_000;
/** Budget for the interactive public tool, where a visitor is waiting. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Why a fetch failed, as a value rather than a message string.
 *
 * This distinction is load-bearing for outbound. "Your website is down" is a
 * claim about the *prospect*, and only a DNS failure, a refused connection, a
 * TLS failure, or a server error is evidence for it. A timeout is a claim about
 * *this* server's network — on a slow link every large, perfectly healthy page
 * times out — and treating the two the same means emailing a hospital to tell
 * them their working website is broken. Callers branch on `reason`; nothing
 * infers intent from `message`.
 */
export type AuditFailureReason =
  /** Hostname does not resolve — strong evidence the site is gone. */
  | "dns"
  /** Connection refused or reset — strong evidence. */
  | "refused"
  /** TLS handshake or certificate failure — strong evidence of a real problem. */
  | "tls"
  /** The server answered 5xx — strong evidence. */
  | "server-error"
  /** We gave up waiting. Says nothing about the prospect. */
  | "timeout"
  /** Bigger than the cap. Says nothing about whether the site works. */
  | "too-large"
  /** Answered, but not an HTML page. */
  | "not-html"
  /** Resolved to a private or reserved address; refused by the SSRF guard. */
  | "blocked"
  /** Too many redirects, or a redirect with no destination. */
  | "redirect-loop"
  | "unknown";

/** True when the reason is real evidence the prospect's site is broken. */
export function isSiteFailure(reason: AuditFailureReason): boolean {
  return (
    reason === "dns" ||
    reason === "refused" ||
    reason === "tls" ||
    reason === "server-error"
  );
}

export class AuditError extends Error {
  constructor(
    message: string,
    readonly reason: AuditFailureReason,
    readonly statusCode: number | null = null,
  ) {
    super(message);
    this.name = "AuditError";
  }
}

/** Maps a Node socket error to a reason. */
function reasonFromNodeError(error: unknown): AuditFailureReason {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH"
  ) {
    return "refused";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") return "timeout";
  if (
    code.startsWith("ERR_TLS") ||
    code.startsWith("CERT_") ||
    code === "EPROTO"
  ) {
    return "tls";
  }
  if (error instanceof AuditError) return error.reason;
  return "unknown";
}

/**
 * Decompresses a response body when the server used content encoding.
 *
 * Requesting compression matters more than it looks: HTML compresses roughly
 * 4:1, so `identity` quadruples transfer time and turns healthy pages into
 * timeouts on a slow connection — which is precisely how a working site gets
 * mislabelled as down.
 */
function decodeStream(
  response: Readable & { headers: IncomingHttpHeaders },
): Readable {
  const encoding = String(response.headers["content-encoding"] ?? "")
    .toLowerCase()
    .trim();

  // Only the first encoding is honoured; stacked encodings are vanishingly
  // rare and not worth the failure modes.
  switch (encoding.split(",")[0]?.trim()) {
    case "gzip":
      return response.pipe(zlib.createGunzip());
    case "deflate":
      return response.pipe(zlib.createInflate());
    case "br":
      return response.pipe(zlib.createBrotliDecompress());
    default:
      return response;
  }
}

interface FetchedPage {
  finalUrl: URL;
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
  responseTimeMs: number;
}

function requestPage(
  url: URL,
  address: string,
  timeoutMs: number,
): Promise<Omit<FetchedPage, "finalUrl">> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
          "User-Agent":
            "Bitecodes-Passive-Audit/1.0 (+https://bitecodes.com/tools)",
          // Compression is requested deliberately: HTML compresses about 4:1,
          // and `identity` made large healthy pages time out on a slow link.
          "Accept-Encoding": "gzip, deflate, br",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, address, address.includes(":") ? 6 : 4),
        servername: url.hostname,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        // Captured before piping: the decompressed stream carries no headers.
        const headers = response.headers;
        const statusCode = response.statusCode ?? 0;

        let stream: Readable;
        try {
          stream = decodeStream(response);
        } catch {
          request.destroy();
          reject(
            new AuditError(
              "The website response could not be decompressed.",
              "unknown",
            ),
          );
          return;
        }

        stream.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) {
            request.destroy();
            reject(
              new AuditError(
                "The website response exceeded the audit limit.",
                "too-large",
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        stream.on("error", (error) =>
          reject(
            new AuditError(
              "The website response could not be read.",
              reasonFromNodeError(error),
            ),
          ),
        );
        stream.on("end", () =>
          resolve({
            statusCode,
            headers,
            body: Buffer.concat(chunks).toString("utf8"),
            responseTimeMs: Math.round(performance.now() - started),
          }),
        );
      },
    );

    request.on("timeout", () => {
      request.destroy();
      reject(
        new AuditError("The website took too long to respond.", "timeout"),
      );
    });
    request.on("error", (error) =>
      reject(
        new AuditError(
          "The website could not be reached.",
          reasonFromNodeError(error),
        ),
      ),
    );
    request.end();
  });
}

async function fetchPublicPage(
  input: string,
  timeoutMs: number,
): Promise<FetchedPage> {
  let url = normalizeAuditUrl(input);
  let totalResponseTimeMs = 0;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    let addresses: string[];
    try {
      addresses = await assertPublicAuditUrl(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      // Only an authoritative "no such domain" is evidence about the site.
      // A resolver timeout or SERVFAIL is our problem, and mapping it to `dns`
      // would blame the business for our network — the exact false "website
      // down" claim this whole path exists to prevent.
      if (error instanceof DnsResolutionError) {
        throw new AuditError(message, error.domainMissing ? "dns" : "unknown");
      }

      // Anything else from the guard is a refusal: a private or reserved
      // address, which is a data problem on our side.
      throw new AuditError(
        message || "The website address could not be used.",
        "blocked",
      );
    }

    const response = await requestPage(url, addresses[0]!, timeoutMs);
    totalResponseTimeMs += response.responseTimeMs;

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location || redirect === MAX_REDIRECTS) {
        throw new AuditError(
          "The website redirected too many times.",
          "redirect-loop",
        );
      }
      url = normalizeAuditUrl(new URL(location, url).toString());
      continue;
    }

    // A 5xx is the server telling us it is broken — real evidence, unlike a
    // timeout. 4xx is not: a 403 or 404 on the homepage usually means a bot
    // block or a bad tagged URL, not an outage.
    if (response.statusCode >= 500) {
      throw new AuditError(
        `The website returned a server error (${response.statusCode}).`,
        "server-error",
        response.statusCode,
      );
    }

    return { ...response, finalUrl: url, responseTimeMs: totalResponseTimeMs };
  }

  throw new AuditError("The website could not be audited.", "redirect-loop");
}

function contains(html: string, expression: RegExp) {
  return expression.test(html);
}

function addFinding(findings: AuditFinding[], finding: AuditFinding) {
  findings.push(finding);
}

/**
 * The fetched page alongside the audit verdict.
 *
 * Prospect enrichment needs the raw HTML and response headers to read
 * commercial signals (booking widgets, carts, platform fingerprints) that the
 * audit itself does not report. Those fields are deliberately **not** added to
 * `WebsiteAuditResult`: that type is serialised straight to the browser by the
 * public `/api/website-audit` route, and shipping a third party's full HTML to
 * an anonymous caller is not something to do by accident.
 */
export interface AuditedPage {
  html: string;
  headers: IncomingHttpHeaders;
  finalUrl: string;
  /** Bytes of HTML actually inspected, for page-weight signals. */
  htmlBytes: number;
  responseTimeMs: number;
  statusCode: number;
}

/**
 * The public entry point. Returns the verdict only, so no caller can leak the
 * fetched body by forwarding this result.
 */
export async function auditWebsite(input: string): Promise<WebsiteAuditResult> {
  const { result } = await auditWebsiteWithPage(input);
  return result;
}

export interface AuditOptions {
  /**
   * Per-request budget. The public tool keeps the short default because a
   * visitor is watching; background enrichment passes a longer one, since a
   * premature give-up there becomes a false "your website is down" claim.
   */
  timeoutMs?: number;
}

export async function auditWebsiteWithPage(
  input: string,
  { timeoutMs = REQUEST_TIMEOUT_MS }: AuditOptions = {},
): Promise<{ result: WebsiteAuditResult; page: AuditedPage }> {
  const normalized = normalizeAuditUrl(input);
  const page = await fetchPublicPage(normalized.toString(), timeoutMs);
  const html = page.body.slice(0, MAX_RESPONSE_BYTES);
  const headers = page.headers;
  const findings: AuditFinding[] = [];
  const isHtml = String(headers["content-type"] ?? "")
    .toLowerCase()
    .includes("text/html");

  if (!isHtml) {
    throw new AuditError("The URL did not return an HTML webpage.", "not-html");
  }

  addFinding(findings, {
    category: "seo",
    status: contains(html, /<title[^>]*>\s*[^<]{10,70}\s*<\/title>/i)
      ? "pass"
      : "fail",
    title: "Page title",
    detail: contains(html, /<title[^>]*>/i)
      ? "A title exists, but its length or content may need review."
      : "No HTML title was detected.",
    recommendation:
      "Use a unique, descriptive title of roughly 10–70 characters.",
  });
  addFinding(findings, {
    category: "seo",
    status:
      contains(
        html,
        /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{50,180}["']/i,
      ) ||
      contains(
        html,
        /<meta[^>]+content=["'][^"']{50,180}["'][^>]+name=["']description["']/i,
      )
        ? "pass"
        : "warning",
    title: "Meta description",
    detail:
      "Checks whether the initial HTML contains a useful description for search previews.",
    recommendation: "Add a unique, compelling meta description for the page.",
  });
  addFinding(findings, {
    category: "seo",
    status: contains(html, /<link[^>]+rel=["']canonical["']/i)
      ? "pass"
      : "warning",
    title: "Canonical URL",
    detail:
      "Canonical links help search engines consolidate duplicate page variants.",
    recommendation: "Publish an absolute canonical URL on indexable pages.",
  });

  addFinding(findings, {
    category: "performance",
    status:
      page.responseTimeMs <= 800
        ? "pass"
        : page.responseTimeMs <= 2000
          ? "warning"
          : "fail",
    title: "Server response time",
    detail: `The initial HTML response completed in approximately ${page.responseTimeMs} ms.`,
    recommendation:
      "Review server work, caching, hosting location, and database queries.",
  });
  addFinding(findings, {
    category: "performance",
    status: Buffer.byteLength(html) <= 250_000 ? "pass" : "warning",
    title: "Initial HTML size",
    detail: `The inspected HTML was approximately ${Math.round(Buffer.byteLength(html) / 1024)} KB.`,
    recommendation:
      "Reduce duplicated markup and defer non-critical content where appropriate.",
  });

  addFinding(findings, {
    category: "accessibility",
    status: contains(html, /<html[^>]+lang=["'][a-z-]+["']/i) ? "pass" : "fail",
    title: "Document language",
    detail:
      "A language declaration helps assistive technology pronounce content correctly.",
    recommendation: "Set a valid lang attribute on the html element.",
  });
  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithAlt = images.filter((image) =>
    /\balt=["'][^"']*["']/i.test(image),
  );
  addFinding(findings, {
    category: "accessibility",
    status:
      images.length === 0 || imagesWithAlt.length === images.length
        ? "pass"
        : "warning",
    title: "Image alternatives",
    detail: `${imagesWithAlt.length} of ${images.length} image elements include an alt attribute in the initial HTML.`,
    recommendation:
      "Add meaningful alt text, or an empty alt attribute for decorative images.",
  });
  addFinding(findings, {
    category: "accessibility",
    status:
      contains(html, /<main\b/i) && contains(html, /<h1\b/i)
        ? "pass"
        : "warning",
    title: "Landmarks and primary heading",
    detail:
      "The check looks for a main landmark and an H1 in the initial document.",
    recommendation:
      "Use one clear primary heading and semantic page landmarks.",
  });

  const securityChecks: [string, string, string][] = [
    [
      "strict-transport-security",
      "HTTPS enforcement",
      "Enable HSTS after confirming the entire domain is HTTPS-ready.",
    ],
    [
      "content-security-policy",
      "Content Security Policy",
      "Deploy a tested CSP that limits scripts, frames, connections, and other resources.",
    ],
    [
      "x-content-type-options",
      "MIME sniffing protection",
      "Set X-Content-Type-Options to nosniff.",
    ],
    [
      "referrer-policy",
      "Referrer policy",
      "Set an explicit privacy-conscious Referrer-Policy.",
    ],
  ];
  for (const [header, title, recommendation] of securityChecks) {
    addFinding(findings, {
      category: "security",
      status: headers[header] ? "pass" : "warning",
      title,
      detail: headers[header]
        ? "The response includes this defensive header."
        : "This defensive response header was not detected.",
      recommendation,
    });
  }
  addFinding(findings, {
    category: "security",
    status: page.finalUrl.protocol === "https:" ? "pass" : "fail",
    title: "Encrypted connection",
    detail:
      page.finalUrl.protocol === "https:"
        ? "The final page was delivered over HTTPS."
        : "The final page used an unencrypted HTTP connection.",
    recommendation:
      "Redirect all traffic to HTTPS and maintain a valid TLS certificate.",
  });

  const { scores, overallScore } = calculateAuditScores(findings);
  return {
    result: {
      auditedUrl: normalized.toString(),
      finalUrl: page.finalUrl.toString(),
      auditedAt: new Date().toISOString(),
      responseTimeMs: page.responseTimeMs,
      statusCode: page.statusCode,
      scores,
      overallScore,
      findings,
      scope:
        "Passive review of one public HTML response and its response headers. No exploitation, port scanning, authenticated testing, JavaScript execution, or endpoint discovery was performed.",
    },
    page: {
      html,
      headers,
      finalUrl: page.finalUrl.toString(),
      htmlBytes: Buffer.byteLength(html),
      responseTimeMs: page.responseTimeMs,
      statusCode: page.statusCode,
    },
  };
}
