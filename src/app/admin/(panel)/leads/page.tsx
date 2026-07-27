import type { Metadata } from "next";
import Link from "next/link";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import {
  getLeadStats,
  listLeads,
  LEAD_KIND_LABELS,
  LEAD_PAGE_SIZE,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadKind,
  type LeadQuery,
} from "@/lib/server/leads/repository";
import { LeadTable } from "@/components/admin/lead-table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { StatTile } from "@/components/ui/chart";
import type { LeadStatus } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Leads" };

/** Rendered per request: an inbox showing a cached count is worse than useless. */
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

export default async function LeadsPage({ searchParams }: PageProps) {
  await requireCapability("manage_leads");
  const params = await searchParams;

  const query: LeadQuery = {
    search: readParam(params, "q"),
    status: readParam(params, "status") as LeadStatus | "all" | undefined,
    kind: readParam(params, "kind") as LeadKind | "all" | undefined,
    page: Number(readParam(params, "page") ?? "1") || 1,
    pageSize: LEAD_PAGE_SIZE,
  };

  const [result, stats, canEmail] = await Promise.all([
    listLeads(query),
    getLeadStats(),
    hasCapability("send_email"),
  ]);

  const buildHref = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      q: query.search,
      status: query.status === "all" ? undefined : query.status,
      kind: query.kind === "all" ? undefined : query.kind,
      ...changes,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) next.set(key, value);
    }
    const search = next.toString();
    return search ? `/admin/leads?${search}` : "/admin/leads";
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Everyone who came to you. Contact form enquiries, AI consultant
          briefs, and free website audit runs, in one list.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile hero label="Total leads" value={stats.total} />
        <StatTile
          label="New"
          value={stats.byStatus.new ?? 0}
          hint="Not yet triaged."
        />
        <StatTile label="Qualified" value={stats.byStatus.qualified ?? 0} />
        <StatTile
          label="Won"
          value={stats.byStatus.won ?? 0}
          hint="Closed business from inbound."
        />
      </div>

      {/* A GET form and plain links, so every view is a shareable URL and the
          page still filters with JavaScript disabled. */}
      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <form
          method="GET"
          action="/admin/leads"
          className="flex flex-wrap gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={query.search ?? ""}
            placeholder="Search name, email, company, message, or reference"
            aria-label="Search leads"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-11 min-w-56 flex-1 rounded-xl border px-4 text-base shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm"
          />
          {query.status && query.status !== "all" && (
            <input type="hidden" name="status" value={query.status} />
          )}
          {query.kind && query.kind !== "all" && (
            <input type="hidden" name="kind" value={query.kind} />
          )}
          <button
            type="submit"
            className="border-border bg-secondary text-secondary-foreground hover:bg-muted h-11 rounded-xl border px-5 text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        <FilterRow label="Stage">
          <FilterChip
            href={buildHref({ status: undefined, page: undefined })}
            active={!query.status || query.status === "all"}
          >
            All
          </FilterChip>
          {LEAD_STATUSES.filter((status) => stats.byStatus[status]).map(
            (status) => (
              <FilterChip
                key={status}
                href={buildHref({ status, page: undefined })}
                active={query.status === status}
              >
                {LEAD_STATUS_LABELS[status]}
                <Badge variant="muted" className="ml-1 px-1.5 py-0">
                  {stats.byStatus[status]}
                </Badge>
              </FilterChip>
            ),
          )}
        </FilterRow>

        <FilterRow label="Source">
          <FilterChip
            href={buildHref({ kind: undefined, page: undefined })}
            active={!query.kind || query.kind === "all"}
          >
            All
          </FilterChip>
          {(["enquiry", "consultant", "audit"] as LeadKind[])
            .filter((kind) => stats.byKind[kind])
            .map((kind) => (
              <FilterChip
                key={kind}
                href={buildHref({ kind, page: undefined })}
                active={query.kind === kind}
              >
                {LEAD_KIND_LABELS[kind]}
                <Badge variant="muted" className="ml-1 px-1.5 py-0">
                  {stats.byKind[kind]}
                </Badge>
              </FilterChip>
            ))}
        </FilterRow>
      </section>

      <LeadTable
        rows={result.items}
        query={{
          search: query.search,
          status: query.status,
          kind: query.kind,
        }}
        canManage
        canEmail={canEmail}
      />

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

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground w-full text-xs font-medium tracking-wide uppercase sm:w-auto">
        {label}
      </span>
      {children}
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
