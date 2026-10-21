import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import {
  expireProposalIfStale,
  getProposal,
} from "@/lib/server/proposals/repository";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Proposal preview" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalPreviewPage({ params }: PageProps) {
  await requireCapability("manage_leads");
  const { id } = await params;

  let proposal = await getProposal(id);
  if (!proposal) notFound();

  if (
    (proposal.status === "sent" || proposal.status === "viewed") &&
    (await expireProposalIfStale(proposal.proposalId))
  ) {
    proposal = (await getProposal(proposal.proposalId)) ?? proposal;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/proposals/${proposal.proposalId}`}>
            <ArrowLeft className="size-4" />
            Back to proposal
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/proposals/${proposal.proposalId}`} target="_self">
            Edit
          </Link>
        </Button>
      </div>

      <div className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-4 print:hidden">
        <Eye className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground text-sm leading-relaxed">
          This is the document as the client sees it. Their version also shows
          the accept and decline controls after the terms. Opening this preview
          does not count as a client view.
        </p>
      </div>

      <div className="mx-auto w-full max-w-4xl py-6">
        <ProposalDocument proposal={proposal} />
      </div>
    </div>
  );
}
