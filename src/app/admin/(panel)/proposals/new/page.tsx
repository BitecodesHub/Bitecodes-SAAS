import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { getLead } from "@/lib/server/leads/repository";
import { prefillFromLead } from "@/lib/server/proposals/prefill";
import { emptyProposalForm } from "@/lib/proposals/form";
import { parseProposalLeadRef } from "@/lib/proposals/display";
import { ProposalEditor } from "@/components/proposals/proposal-editor";

export const metadata: Metadata = { title: "New proposal" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}

export default async function NewProposalPage({ searchParams }: PageProps) {
  await requireCapability("manage_leads");
  const params = await searchParams;
  const leadParam = readParam(params, "lead");
  const leadRef = leadParam ? parseProposalLeadRef(leadParam) : null;

  const lead = leadRef ? await getLead(leadRef.kind, leadRef.id) : null;
  const prefill =
    leadRef && lead ? prefillFromLead(leadRef.kind, leadRef.id, lead) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/proposals"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          All proposals
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New proposal</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Choose the services, set the narrative and milestones, then save as a
          draft. Sending happens from the record so the client always receives a
          working private link.
        </p>
      </header>

      {leadParam && !prefill && (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-2xl border p-4 text-sm">
          The linked lead could not be found, so this proposal starts blank. You
          can still create it and link the lead later.
        </div>
      )}

      {prefill && (
        <div className="border-primary/25 bg-primary/5 rounded-2xl border p-4">
          <p className="text-sm font-medium">Prefilled from a lead</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {prefill.sourceNote}
          </p>
        </div>
      )}

      <ProposalEditor mode="create" initial={prefill ?? emptyProposalForm()} />
    </div>
  );
}
