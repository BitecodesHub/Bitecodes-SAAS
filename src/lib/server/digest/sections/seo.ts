import "server-only";

import type { DigestRange, DigestSection } from "@/lib/server/digest/types";
import { seoAudits } from "@/lib/server/db/collections";
import {
  getBingSiteVerification,
  getGoogleSiteVerification,
  getIndexNowKey,
} from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";
import { siteConfig } from "@/lib/site";
import type { EmailBlock } from "@/lib/email/template";

/**
 * Digest section "seo": the latest weekly self-audit and the external setup
 * that is still missing.
 *
 * Only the audit inside the reporting window is considered, so last week's
 * regressions are not reported twice. Setup gaps are included because they are
 * the one search problem that never resolves without the owner.
 */
export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  const [audit, settings] = await Promise.all([
    seoAudits().then((collection) =>
      collection.findOne(
        {
          date: {
            $gte: range.from.toISOString().slice(0, 10),
            $lt: range.to.toISOString().slice(0, 10),
          },
        },
        { sort: { date: -1 } },
      ),
    ),
    getSettings(),
  ]);

  const gaps: string[] = [];
  if (!getGoogleSiteVerification()) {
    gaps.push("Google Search Console verification token is not set.");
  }
  if (!getBingSiteVerification()) {
    gaps.push("Bing Webmaster Tools verification token is not set.");
  }
  if (!getIndexNowKey()) {
    gaps.push("INDEXNOW_KEY is not set, so changed pages are not submitted.");
  }
  if (!settings.growth.seoSelfAudit) {
    gaps.push("The weekly SEO self-audit is switched off.");
  }

  if (!audit && gaps.length === 0) return null;

  const regressions = audit?.regressions ?? [];
  const summary = audit
    ? `SEO self-audit for ${audit.date}: overall ${audit.overallScore ?? "unavailable"}/100 across ${audit.pages.length} pages, ${regressions.length} regression${regressions.length === 1 ? "" : "s"}.`
    : `No SEO self-audit ran this week. ${gaps.length} setup item${gaps.length === 1 ? "" : "s"} need attention.`;

  const blocks: EmailBlock[] = [{ type: "p", text: summary }];

  if (regressions.length > 0) {
    blocks.push({ type: "h2", text: "Regressions" });
    blocks.push({ type: "ul", items: regressions });
  }

  if (gaps.length > 0) {
    blocks.push({ type: "h2", text: "Setup gaps" });
    blocks.push({ type: "ul", items: gaps });
  }

  blocks.push({
    type: "cta",
    label: "Open SEO",
    url: `${siteConfig.url}/admin/seo`,
  });

  return {
    id: "seo",
    title: "SEO",
    summary,
    metrics: [
      { label: "Overall score", value: audit?.overallScore ?? "—" },
      { label: "Pages audited", value: audit?.pages.length ?? 0 },
      { label: "Regressions", value: regressions.length },
      { label: "Setup gaps", value: gaps.length },
    ],
    blocks,
    actions: [{ label: "Open SEO", href: "/admin/seo" }],
  };
}
