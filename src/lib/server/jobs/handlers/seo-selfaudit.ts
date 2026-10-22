import "server-only";

import { auditWebsiteWithPage } from "@/lib/server/website-auditor";
import { seoAudits } from "@/lib/server/db/collections";
import type { SeoAuditDoc } from "@/lib/server/db/types";
import { getSiteUrl } from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";
import { JobDeferredError } from "@/lib/server/jobs/queue";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * `seo.selfaudit` — Audits this site's key pages weekly and reports drops.
 *
 * The auditor is the same one the public tool uses, but pointed at Bitecodes
 * itself. One document per UTC date; a rerun upserts rather than duplicates.
 * A regression is a page whose overall score fell, or one that could not be
 * audited after previously succeeding.
 */

export const AUDIT_PATHS = [
  "/",
  "/services",
  "/pricing",
  "/contact",
  "/website-audit",
  "/services/website-development",
  "/services/ai-integration",
  "/blog",
] as const;

export interface AuditPageResult {
  path: string;
  score: number | null;
  issues: string[];
}

/**
 * Compares this run with the previous stored run.
 *
 * Returns plain sentences because these are read by the owner in the admin
 * panel and the digest, not parsed by another system.
 */
export function compareAudits(
  previous: Pick<SeoAuditDoc, "pages"> | null,
  current: AuditPageResult[],
): string[] {
  if (!previous) return [];

  const before = new Map(previous.pages.map((page) => [page.path, page]));
  const regressions: string[] = [];

  for (const page of current) {
    const old = before.get(page.path);
    if (!old) continue;

    if (page.score === null) {
      regressions.push(`${page.path}: could not be audited this run.`);
      continue;
    }

    if (old.score !== null && page.score < old.score) {
      regressions.push(
        `${page.path}: score fell from ${old.score} to ${page.score}.`,
      );
    }

    const previousIssues = new Set(old.issues);
    for (const issue of page.issues) {
      if (!previousIssues.has(issue)) {
        regressions.push(`${page.path}: new issue — ${issue}.`);
      }
    }
  }

  return regressions;
}

function overallScore(pages: AuditPageResult[]): number | null {
  const scores = pages
    .map((page) => page.score)
    .filter((score): score is number => score !== null);
  if (scores.length === 0) return null;
  return Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
}

export async function handleSeoSelfAudit(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettings();
  if (!settings.growth.seoSelfAudit) {
    context.log("Weekly SEO self-audit is switched off.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const origin = getSiteUrl().replace(/\/$/, "");
  const collection = await seoAudits();
  const previous = await collection.findOne(
    { date: { $lt: date } },
    { sort: { date: -1 } },
  );

  const pages: AuditPageResult[] = [];

  for (const path of AUDIT_PATHS) {
    // Each fetch has an 8s ceiling. Stop starting new pages once the run has
    // less than that left, rather than being killed mid-request with the job
    // lock still held.
    if (Date.now() + 8_000 > context.deadline) {
      context.log(`Stopped before ${path}: not enough time left in this run.`);
      break;
    }

    try {
      const { result } = await auditWebsiteWithPage(`${origin}${path}`, {
        timeoutMs: 8_000,
      });
      pages.push({
        path,
        score: result.overallScore,
        issues: result.findings
          .filter((finding) => finding.status !== "pass")
          .map((finding) => `${finding.category}: ${finding.title}`),
      });
      context.log(`${path}: ${result.overallScore}/100.`);
    } catch (error) {
      pages.push({
        path,
        score: null,
        issues: [
          `audit failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
      context.log(
        `${path}: audit failed — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (pages.length === 0) {
    throw new JobDeferredError(
      "Not enough time left in this run to audit any page.",
      15 * 60 * 1000,
    );
  }

  const regressions = compareAudits(previous, pages);
  const score = overallScore(pages);

  await collection.updateOne(
    { date },
    {
      $set: {
        pages,
        overallScore: score,
        regressions,
        createdAt: now,
      },
      $setOnInsert: { date },
    },
    { upsert: true },
  );

  context.log(
    `Audited ${pages.length} page${pages.length === 1 ? "" : "s"}; overall ${score ?? "unavailable"}; ${regressions.length} regression${regressions.length === 1 ? "" : "s"}.`,
  );

  return {
    date,
    pages: pages.length,
    overallScore: score,
    regressions,
  };
}
