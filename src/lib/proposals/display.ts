import type {
  ProposalLeadKind,
  ProposalStatus,
  ProposalTermsLink,
} from "@/lib/server/db/types";

/**
 * Client-safe proposal vocabulary.
 *
 * Labels live outside `lib/server/proposals/repository.ts` because that module
 * is `server-only`; a client component importing a label from it would pull the
 * MongoDB driver into the browser bundle. Type-only imports are erased, so the
 * dependency on the document type is free.
 */

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export const PROPOSAL_LEAD_KIND_LABELS: Record<ProposalLeadKind, string> = {
  enquiry: "Contact form",
  consultant: "AI consultant",
  audit: "Website audit",
};

export const PROPOSAL_PAGE_SIZE = 20;

/**
 * The terms every proposal points at. Relative paths work on the public page;
 * the admin editor never needs to rewrite them.
 */
export const PROPOSAL_TERMS_LINKS: ProposalTermsLink[] = [
  { label: "Guarantees", url: "/guarantees" },
  { label: "Terms & Conditions", url: "/terms" },
];

export function parseProposalLeadRef(
  value: string | null | undefined,
): { kind: ProposalLeadKind; id: string } | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind !== "enquiry" && kind !== "consultant" && kind !== "audit") {
    return null;
  }
  return { kind, id };
}

export function formatProposalLeadRef(
  kind: ProposalLeadKind,
  id: string,
): `${ProposalLeadKind}:${string}` {
  return `${kind}:${id}`;
}
