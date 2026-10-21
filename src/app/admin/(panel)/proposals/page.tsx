import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import {
  getProposalStats,
  listProposals,
  type ProposalQuery,
} from "@/lib/server/proposals/repository";
import {
  PROPOSAL_PAGE_SIZE,
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
} from "@/lib/proposals/display";
import { formatAmount, type CurrencyCode } from "@/lib/pricing";
import { Pagination } from "@/components/ui/pagination";
import { StatTile } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProposalStatus } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Proposals" };
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

function statusVariant(status: ProposalStatus) {
  switch (status) {
    case "sent":
    case "viewed":
      return "default" as const;
    case "accepted":
      return "secondary" as const;
    case "declined":
    case "expired":
      return "muted" as const;
    default:
      return "outline" as const;
  }
}

function formatValues(values: Partial<Record<CurrencyCode, number>>): string {
  const entries = (Object.entries(values) as [CurrencyCode, number][]).filter(
    ([, amount]) => amount > 0,
  );
  if (entries.length === 0) return "None";
  return entries
    .map(([currency, amount]) => formatAmount(amount, currency))
    .join(" · ");
}

export default async function AdminProposalsPage({ searchParams }: PageProps) {
  await requireCapability("manage_leads");
  const params = await searchParams;

  const statusParam = readParam(params, "status");
  const query: ProposalQuery = {
    search: readParam(params, "q"),
    status: PROPOSAL_STATUSES.includes(statusParam as ProposalStatus)
      ? (statusParam as ProposalStatus)
      : "all",
    page: Number(readParam(params, "page") ?? "1") || 1,
    pageSize: PROPOSAL_PAGE_SIZE,
  };

  const [result, stats] = await Promise.all([
    listProposals(query),
    getProposalStats(),
  ]);

  const buildHref = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      q: query.search,
      status: query.status === "all" ? undefined : query.status,
      ...changes,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) next.set(key, value);
    }
    const search = next.toString();
    return search ? `/admin/proposals?${search}` : "/admin/proposals";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Priced from the published rates, sent from your own domain, and
            accepted with a typed signature. Every view and response is on the
            record.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/proposals/new">
            <Plus className="size-4" />
            New proposal
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile hero label="Total proposals" value={stats.total} />
        <StatTile
          label="Awaiting a reply"
          value={(stats.byStatus.sent ?? 0) + (stats.byStatus.viewed ?? 0)}
          hint={formatValues(stats.openValueByCurrency)}
        />
        <StatTile
          label="Accepted"
          value={stats.byStatus.accepted ?? 0}
          hint={formatValues(stats.acceptedValueByCurrency)}
        />
        <StatTile
          label="Drafts"
          value={stats.byStatus.draft ?? 0}
          hint="Not yet sent."
        />
      </div>

      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <form
          method="GET"
          action="/admin/proposals"
          className="flex flex-wrap gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={query.search ?? ""}
            placeholder="Search client, company, reference, or title"
            aria-label="Search proposals"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-11 min-w-56 flex-1 rounded-xl border px-4 text-base shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm"
          />
          {query.status && query.status !== "all" && (
            <input type="hidden" name="status" value={query.status} />
          )}
          <button
            type="submit"
            className="border-border bg-secondary text-secondary-foreground hover:bg-muted h-11 rounded-xl border px-5 text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground w-full text-xs font-medium tracking-wide uppercase sm:w-auto">
            Status
          </span>
          <FilterChip
            href={buildHref({ status: undefined, page: undefined })}
            active={query.status === "all"}
          >
            All
            <Badge variant="muted" className="ml-1 px-1.5 py-0">
              {stats.total}
            </Badge>
          </FilterChip>
          {PROPOSAL_STATUSES.filter((status) => stats.byStatus[status] > 0).map(
            (status) => (
              <FilterChip
                key={status}
                href={buildHref({ status, page: undefined })}
                active={query.status === status}
              >
                {PROPOSAL_STATUS_LABELS[status]}
                <Badge variant="muted" className="ml-1 px-1.5 py-0">
                  {stats.byStatus[status]}
                </Badge>
              </FilterChip>
            ),
          )}
        </div>
      </section>

      <section className="border-border bg-card overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)]">
        {result.items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">No proposals match this view.</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
              Start from a lead to prefill the client, or build one from scratch
              and link it later.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Proposal</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 font-medium">Valid until</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((proposal) => (
                  <tr
                    key={proposal.proposalId}
                    className="border-border hover:bg-muted/30 border-t transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/proposals/${proposal.proposalId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {proposal.company ||
                          proposal.clientName ||
                          "Unnamed client"}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {proposal.clientName && proposal.company
                          ? proposal.clientName
                          : proposal.clientEmail || proposal.proposalId}
                      </p>
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      <p className="truncate">{proposal.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {proposal.proposalId}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right font-medium whitespace-nowrap">
                      {formatAmount(proposal.total, proposal.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(proposal.status)}>
                        {PROPOSAL_STATUS_LABELS[proposal.status]}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-5 py-4 whitespace-nowrap">
                      {proposal.updatedAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="text-muted-foreground px-5 py-4 whitespace-nowrap">
                      {proposal.validUntil
                        ? proposal.validUntil.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "No expiry"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result.total > result.pageSize && (
        <Pagination
          page={result.page}
          totalItems={result.total}
          perPage={result.pageSize}
          buildHref={(target) => buildHref({ page: String(target) })}
        />
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "border-primary bg-primary text-primary-foreground inline-flex items-center rounded-full border px-3 py-1 text-sm"
          : "border-border bg-background text-foreground hover:bg-muted inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors"
      }
    >
      {children}
    </Link>
  );
}
