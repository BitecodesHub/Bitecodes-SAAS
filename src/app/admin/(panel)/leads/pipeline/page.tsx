import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import {
  getLeadStats,
  LEAD_STAGES,
  listLeads,
  type LeadPage,
} from "@/lib/server/leads/repository";
import { PipelineBoard } from "@/components/admin/pipeline-board";
import type { LeadStage } from "@/lib/leads/display";

export const metadata: Metadata = { title: "Pipeline" };

export const dynamic = "force-dynamic";

/**
 * The board reads each column separately instead of paginating one unified
 * list. A single 100-row page would leave some columns looking empty even when
 * they have plenty of leads; six scoped queries give every column its own
 * newest 100, and the header count comes from the full aggregation.
 */
export default async function PipelinePage() {
  await requireCapability("manage_leads");

  const [stats, ...pages] = await Promise.all([
    getLeadStats(),
    ...LEAD_STAGES.map((stage) => listLeads({ stage, pageSize: 100 })),
  ]);

  const columns = Object.fromEntries(
    LEAD_STAGES.map((stage, index) => [
      stage,
      (pages[index] as LeadPage).items,
    ]),
  ) as Record<LeadStage, LeadPage["items"]>;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/admin/leads"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to the inbox
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          The same leads as the inbox, grouped by stage. A lead is either in the
          inbox or on this board — never two copies.
        </p>
      </header>

      <PipelineBoard columns={columns} counts={stats.byStage} />
    </div>
  );
}
