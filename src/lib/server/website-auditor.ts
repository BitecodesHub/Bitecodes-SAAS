import "server-only";

import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import type { IncomingHttpHeaders } from "node:http";
import {
  calculateAuditScores,
  type AuditFinding,
  type WebsiteAuditResult,
} from "@/lib/website-audit";
import { assertPublicAuditUrl, normalizeAuditUrl } from "@/lib/server/safe-url";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 8_000;

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
          "Accept-Encoding": "identity",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, address, address.includes(":") ? 6 : 4),
        servername: url.hostname,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;

        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) {
            request.destroy(
              new Error("The website response exceeded the audit limit."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            responseTimeMs: Math.round(performance.now() - started),
          }),
        );
      },
    );

    request.on("timeout", () =>
      request.destroy(new Error("The website took too long to respond.")),
    );
    request.on("error", reject);
    request.end();
  });
}

async function fetchPublicPage(input: string): Promise<FetchedPage> {
  let url = normalizeAuditUrl(input);
  let totalResponseTimeMs = 0;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const addresses = await assertPublicAuditUrl(url);
    const response = await requestPage(url, addresses[0]);
    totalResponseTimeMs += response.responseTimeMs;

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("The website redirected too many times.");
      }
      url = normalizeAuditUrl(new URL(location, url).toString());
      continue;
    }

    return { ...response, finalUrl: url, responseTimeMs: totalResponseTimeMs };
  }

  throw new Error("The website could not be audited.");
}

function contains(html: string, expression: RegExp) {
  return expression.test(html);
}

function addFinding(findings: AuditFinding[], finding: AuditFinding) {
  findings.push(finding);
}

export async function auditWebsite(input: string): Promise<WebsiteAuditResult> {
  const normalized = normalizeAuditUrl(input);
  const page = await fetchPublicPage(normalized.toString());
  const html = page.body.slice(0, MAX_RESPONSE_BYTES);
  const headers = page.headers;
  const findings: AuditFinding[] = [];
  const isHtml = String(headers["content-type"] ?? "")
    .toLowerCase()
    .includes("text/html");

  if (!isHtml) throw new Error("The URL did not return an HTML webpage.");

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
  };
}
