import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import {
  expireProposalIfStale,
  getProposal,
  proposalPublicPath,
} from "@/lib/server/proposals/repository";
import {
  PROPOSAL_LEAD_KIND_LABELS,
  PROPOSAL_STATUS_LABELS,
  parseProposalLeadRef,
} from "@/lib/proposals/display";
import { proposalFormFromDoc } from "@/lib/proposals/form";
import { formatAmount } from "@/lib/pricing";
import { ProposalEditor } from "@/components/proposals/proposal-editor";
import { ProposalAdminActions } from "@/components/proposals/proposal-admin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Proposal" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Not yet";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDate(value: Date | null): string {
  if (!value) return "No expiry";
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ProposalDetailPage({ params }: PageProps) {
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

  const canSendEmail = await hasCapability("send_email");
  const canEdit =
    proposal.status === "draft" ||
    proposal.status === "sent" ||
    proposal.status === "viewed";
  const lead = parseProposalLeadRef(proposal.leadRef);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/proposals">
            <ArrowLeft className="size-4" />
            All proposals
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{proposal.proposalId}</Badge>
            <Badge
              variant={
                proposal.status === "accepted"
                  ? "secondary"
                  : proposal.status === "draft"
                    ? "outline"
                    : proposal.status === "sent" || proposal.status === "viewed"
                      ? "default"
                      : "muted"
              }
            >
              {PROPOSAL_STATUS_LABELS[proposal.status]}
            </Badge>
            {proposal.aiAssisted && (
              <Badge variant="muted">
                <Sparkles className="size-3" />
                AI assisted
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {proposal.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {proposal.company || proposal.clientName || "Unnamed client"}
            {proposal.clientEmail ? ` · ${proposal.clientEmail}` : ""}
          </p>
        </div>
        <p className="text-2xl font-semibold tracking-tight">
          {formatAmount(proposal.total, proposal.currency)}
        </p>
      </header>

      <ProposalAdminActions
        proposalId={proposal.proposalId}
        status={proposal.status}
        publicPath={proposalPublicPath(proposal.proposalId)}
        canSendEmail={canSendEmail}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr] xl:items-start">
        <ProposalEditor
          mode="edit"
          proposalId={proposal.proposalId}
          initial={proposalFormFromDoc(proposal)}
          status={proposal.status}
          canEdit={canEdit}
        />

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold">Record</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Fact
                label="Created"
                value={formatDateTime(proposal.createdAt)}
              />
              <Fact
                label="Last updated"
                value={formatDateTime(proposal.updatedAt)}
              />
              <Fact label="Sent" value={formatDateTime(proposal.sentAt)} />
              <Fact
                label="First viewed"
                value={formatDateTime(proposal.viewedAt)}
              />
              <Fact
                label="Views"
                value={
                  proposal.viewCount > 0
                    ? `${proposal.viewCount} (last ${formatDateTime(proposal.lastViewedAt)})`
                    : "None recorded"
                }
              />
              <Fact
                label="Valid until"
                value={formatDate(proposal.validUntil)}
              />
              {proposal.acceptedAt && (
                <Fact
                  label="Accepted"
                  value={formatDateTime(proposal.acceptedAt)}
                />
              )}
              {proposal.declinedAt && (
                <Fact
                  label="Declined"
                  value={formatDateTime(proposal.declinedAt)}
                />
              )}
            </dl>
          </section>

          {lead && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">Linked lead</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {PROPOSAL_LEAD_KIND_LABELS[lead.kind]}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={`/admin/leads/${lead.kind}/${lead.id}`}>
                  Open the lead
                </Link>
              </Button>
            </section>
          )}

          {proposal.acceptance && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">Acceptance</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Fact label="Signed by" value={proposal.acceptance.name} />
                <Fact label="Title" value={proposal.acceptance.title} />
                <Fact label="Signature" value={proposal.acceptance.signature} />
                <Fact
                  label="Signed at"
                  value={formatDateTime(proposal.acceptance.acceptedAt)}
                />
              </dl>
            </section>
          )}

          {proposal.decline && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">Decline</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {proposal.decline.reason}
              </p>
              <p className="text-muted-foreground mt-3 text-xs">
                {proposal.decline.source === "owner"
                  ? "Recorded by the team"
                  : "Provided by the client"}{" "}
                on {formatDateTime(proposal.decline.declinedAt)}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
