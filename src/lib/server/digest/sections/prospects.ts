import "server-only";

import type { DigestRange, DigestSection } from "@/lib/server/digest/types";

import { listProspects } from "@/lib/server/prospecting/repository";
import { GROWTH_TOGGLES, getGrowthToggle } from "@/lib/growth/toggles";
import { getSettingsFresh } from "@/lib/server/settings";

/**
 * Digest section "prospects": Prospects discovered, researched, and drafted for outreach.
 *
 * Placeholder created by the foundation; owned by the prospect-ai package, which
 * replaces this body. Return null when there is nothing to report.
 */
export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  const settings = await getSettingsFresh();

  const prospectResearchToggle = getGrowthToggle("prospectResearch");
  const outreachDraftsToggle = getGrowthToggle("outreachDrafts");

  const researchEnabled = prospectResearchToggle.defaultValue;
  const draftsEnabled = outreachDraftsToggle.defaultValue;

  let total = 0;
  let researched = 0;
  let drafted = 0;
  let needsResearch = 0;

  if (researchEnabled || draftsEnabled) {
    const { items } = await listProspects({
      status: "qualified",
      page: 1,
      pageSize: 100,
    });

    total = items.length;

    for (const prospect of items) {
      if (prospect.research) {
        researched += 1;
      } else {
        needsResearch += 1;
      }

      if (prospect.outreachDraftedAt) {
        drafted += 1;
      }
    }
  }

  const labels: Record<string, string> = {
    researchEnabled: prospectResearchToggle.label,
    outreachDraftsEnabled: outreachDraftsToggle.label,
  };

  if (total === 0) {
    return null;
  }

  return {
    id: "prospects",
    title: "Prospects",
    summary: `${researched} researched, ${needsResearch} need research, ${drafted} drafted`,
    metrics: [
      { label: "Total", value: String(total) },
      { label: "Researched", value: researched > 0 ? String(researched) : "0" },
      { label: "Drafted", value: drafted > 0 ? String(drafted) : "0" },
    ],
    blocks: [],
    actions: [
      { label: prospectResearchToggle.label, href: "/admin/growth" },
      { label: outreachDraftsToggle.label, href: "/admin/growth" },
    ],
  };
}
