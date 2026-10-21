import "server-only";

import {
  countLeadsInRange,
  getLeadDigestData,
} from "@/lib/server/leads/repository";
import { LEAD_KIND_LABELS, type LeadKind } from "@/lib/leads/display";
import type {
  DigestMetric,
  DigestRange,
  DigestSection,
} from "@/lib/server/digest/types";

/**
 * Digest section "leads": new inbound, where it came from, and what has been
 * waiting too long for a reply.
 *
 * "Waiting" is deliberately one day old or more. A lead that arrived this
 * morning is not late, and reporting it as such would train the owner to ignore
 * the section.
 */

export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  const span = range.to.getTime() - range.from.getTime();
  const previousFrom = new Date(range.from.getTime() - span);

  const [total, previousTotal, data] = await Promise.all([
    countLeadsInRange(range.from, range.to),
    countLeadsInRange(previousFrom, range.from),
    getLeadDigestData(range.from, range.to, range.to),
  ]);

  if (total === 0 && data.waitingTotal === 0) return null;

  const change = percentChange(total, previousTotal);
  const topSource = Object.entries(data.byKind).sort((a, b) => b[1] - a[1])[0];

  const metrics: DigestMetric[] = [
    { label: "New leads", value: total, change },
  ];
  if (topSource) {
    metrics.push({
      label: "Top source",
      value: `${LEAD_KIND_LABELS[topSource[0] as LeadKind] ?? topSource[0]} (${topSource[1]})`,
    });
  }
  if (data.waitingTotal > 0) {
    metrics.push({ label: "Waiting over a day", value: data.waitingTotal });
  }

  const blocks: DigestSection["blocks"] = [
    {
      type: "p" as const,
      text: topSource
        ? `${total} new lead(s); ${LEAD_KIND_LABELS[topSource[0] as LeadKind] ?? topSource[0]} was the largest source with ${topSource[1]}.`
        : `${total} new lead(s).`,
    },
  ];

  if (data.waiting.length > 0) {
    blocks.push({
      type: "ul",
      items: data.waiting.map((lead) => {
        const who = lead.name ?? lead.email ?? lead.reference;
        const age = Math.max(
          1,
          Math.round(
            (range.to.getTime() - lead.createdAt.getTime()) / 86_400_000,
          ),
        );
        return `${who} — ${lead.stage}, ${age} day(s) old${lead.nextAction ? `; next: ${lead.nextAction}` : ""}.`;
      }),
    });
  }

  return {
    id: "leads",
    title: "Leads",
    summary: `${total} new lead(s)${change ? ` (${change})` : ""}${
      data.waitingTotal > 0
        ? `, ${data.waitingTotal} waiting over a day for a reply`
        : ""
    }.`,
    metrics,
    blocks,
    actions:
      data.waitingTotal > 0
        ? [
            {
              label: "Work the waiting leads",
              href: "/admin/leads?stage=new",
            },
            { label: "Open the pipeline", href: "/admin/leads/pipeline" },
          ]
        : undefined,
  };
}

function percentChange(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "new" : null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "flat";
  return `${change > 0 ? "+" : ""}${change}%`;
}
