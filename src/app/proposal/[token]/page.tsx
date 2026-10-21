import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  expireProposalIfStale,
  getProposalByToken,
  recordProposalView,
} from "@/lib/server/proposals/repository";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { ProposalResponse } from "@/components/proposals/proposal-response";

/**
 * The private proposal page.
 *
 * The token in the URL is the credential: it is derived from a keyed hash and
 * only its SHA-256 digest is stored, so this page can verify a link but the
 * database cannot reveal one. Drafts are not viewable, views are counted here
 * (a server render is the view), and expiry is re-checked on every request so a
 * stale job can never keep a lapsed proposal acceptable.
 *
 * `noindex` is set in metadata rather than `next.config.ts`, which another
 * package owns.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Proposal",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PublicProposalPage({ params }: PageProps) {
  const { token } = await params;
  let proposal = await getProposalByToken(token);

  if (!proposal || proposal.status === "draft") notFound();

  if (
    (proposal.status === "sent" || proposal.status === "viewed") &&
    (await expireProposalIfStale(proposal.proposalId))
  ) {
    proposal = await getProposalByToken(token);
    if (!proposal || proposal.status === "draft") notFound();
  }

  if (proposal.status === "sent" || proposal.status === "viewed") {
    const updated = await recordProposalView(proposal.proposalId);
    if (updated) proposal = updated;
  }

  const isOpen = proposal.status === "sent" || proposal.status === "viewed";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14 print:py-0">
      <ProposalDocument
        proposal={proposal}
        actions={isOpen ? <ProposalResponse token={token} /> : null}
      />
    </div>
  );
}
