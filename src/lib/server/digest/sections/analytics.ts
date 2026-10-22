import "server-only";

import { formatVital } from "@/lib/analytics";
import type { DigestRange, DigestSection } from "@/lib/server/digest/types";
import { getAnalyticsOverview } from "@/lib/server/analytics/repository";
import { siteConfig } from "@/lib/site";
import type { EmailBlock } from "@/lib/email/template";

/**
 * Digest section "analytics": traffic, conversion, traffic sources, and the
 * three most useful performance or funnel observations for the period.
 *
 * Reads the same read model as the admin dashboard so the email and the page
 * cannot disagree. Returns null when nothing was recorded, which keeps a quiet
 * week out of the owner's inbox.
 */
export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  const overview = await getAnalyticsOverview(range, {
    topPagesLimit: 5,
    sourcesLimit: 5,
    campaignsLimit: 5,
    eventsLimit: 10,
    vitalsPathLimit: 5,
  });

  if (overview.totals.pageviews === 0 && overview.totals.events === 0) {
    return null;
  }

  const { totals } = overview;
  const lcp = overview.vitals.find((vital) => vital.metric === "LCP");
  const lcpValue = lcp && lcp.p75 !== null ? formatVital("LCP", lcp.p75) : "—";

  const summary = `${totals.pageviews.toLocaleString("en-US")} page views from ${totals.visitors.toLocaleString("en-US")} daily visitors, ${totals.ctaClicks.toLocaleString("en-US")} CTA clicks, and ${totals.formSubmits.toLocaleString("en-US")} form submissions (${totals.conversionRate}% of visitors).`;

  const blocks: EmailBlock[] = [{ type: "p", text: summary }];

  if (overview.topPages.length > 0) {
    blocks.push({ type: "h2", text: "Top pages" });
    blocks.push({
      type: "ul",
      items: overview.topPages.map(
        (page) =>
          `${page.path}: ${page.pageviews.toLocaleString("en-US")} views from ${page.visitors.toLocaleString("en-US")} visitors.`,
      ),
    });
  }

  if (overview.sources.length > 0) {
    blocks.push({ type: "h2", text: "Traffic sources" });
    blocks.push({
      type: "ul",
      items: overview.sources.map(
        (source) =>
          `${source.source === "direct" ? "Direct" : source.source}: ${source.pageviews.toLocaleString("en-US")} views.`,
      ),
    });
  }

  if (overview.campaigns.length > 0) {
    blocks.push({ type: "h2", text: "Campaigns" });
    blocks.push({
      type: "ul",
      items: overview.campaigns.map(
        (campaign) =>
          `${campaign.source ?? "unknown source"} / ${campaign.medium ?? "unknown medium"} / ${campaign.campaign ?? "unknown campaign"}: ${campaign.pageviews.toLocaleString("en-US")} views from ${campaign.visitors.toLocaleString("en-US")} visitors.`,
      ),
    });
  }

  if (overview.improvements.length > 0) {
    blocks.push({ type: "h2", text: "What to improve" });
    blocks.push({ type: "ul", items: overview.improvements.slice(0, 3) });
  }

  blocks.push({
    type: "cta",
    label: "Open analytics",
    url: `${siteConfig.url}/admin/analytics?days=7`,
  });

  return {
    id: "analytics",
    title: "Website analytics",
    summary,
    metrics: [
      { label: "Visitors", value: totals.visitors },
      { label: "Page views", value: totals.pageviews },
      { label: "CTA clicks", value: totals.ctaClicks },
      { label: "Form submissions", value: totals.formSubmits },
      { label: "Visit to lead", value: `${totals.conversionRate}%` },
      { label: "LCP p75", value: lcpValue },
    ],
    blocks,
    actions: [{ label: "Open analytics", href: "/admin/analytics" }],
  };
}
