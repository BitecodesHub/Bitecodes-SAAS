import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import {
  listProspectCities,
  listProspects,
  getProspectStats,
  PROSPECT_PAGE_SIZE,
} from "@/lib/server/prospecting/repository";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";
import {
  PROSPECT_PIPELINE,
  PROSPECT_STATUS_LABELS,
} from "@/lib/prospecting/display";
import {
  ProspectTable,
  type ProspectRow,
} from "@/components/admin/prospect-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { StatTile } from "@/components/ui/chart";
import type { ProspectStatus, ProspectTag } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Customers" };

/**
 * Rendered per request. Discovery and enrichment run in the background, so a
 * cached list would keep showing "checking…" for prospects that finished
 * minutes ago.
 */
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

export default async function CustomersPage({ searchParams }: PageProps) {
  await requireCapability("manage_prospects");
  const params = await searchParams;

  const search = readParam(params, "q");
  const status = readParam(params, "status") as
    | ProspectStatus
    | "all"
    | undefined;
  const tag = readParam(params, "tag") as ProspectTag | "all" | undefined;
  const city = readParam(params, "city");
  const searchId = readParam(params, "searchId");
  const emailOnly = readParam(params, "emailOnly") === "1";
  const sort = readParam(params, "sort") as
    | "score"
    | "recent"
    | "name"
    | undefined;
  const page = Number(readParam(params, "page") ?? "1");

  const [result, stats, cities, canManage, canEmail] = await Promise.all([
    listProspects({
      search,
      status,
      tag,
      city,
      searchId,
      emailOnly,
      sort,
      page: Number.isFinite(page) ? page : 1,
      pageSize: PROSPECT_PAGE_SIZE,
    }),
    getProspectStats(),
    listProspectCities(),
    hasCapability("manage_prospects"),
    hasCapability("send_email"),
  ]);

  const rows: ProspectRow[] = result.items.map((prospect) => ({
    id: prospect._id?.toHexString() ?? "",
    name: prospect.name,
    categoryLabel: prospect.categoryLabel,
    city: prospect.city,
    website: prospect.website,
    socialUrl: prospect.socialUrl,
    email: prospect.email,
    phone: prospect.phone,
    status: prospect.status,
    primaryTag: prospect.classification?.primaryTag ?? null,
    score: prospect.classification?.score ?? null,
    topIssue: prospect.classification?.topIssues[0] ?? null,
    contactCount: prospect.contactCount,
  }));

  /** Preserves every active filter while changing one of them. */
  const buildHref = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      q: search,
      status: status === "all" ? undefined : status,
      tag: tag === "all" ? undefined : tag,
      city,
      searchId,
      emailOnly: emailOnly ? "1" : undefined,
      sort,
      ...changes,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/admin/customers?${query}` : "/admin/customers";
  };

  const tagCounts = Object.entries(stats.byTag)
    .filter(([key]) => key !== "unclassified")
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">
            Businesses found on the map, tagged with why they need you.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/customers/discover">
            <MapPin className="size-4" />
            Grab new customers
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile hero label="Total customers" value={stats.total} />
        <StatTile
          label="Reachable by email"
          value={stats.withEmail}
          hint="Have an email address, so outreach can start."
        />
        <StatTile
          label="No website"
          value={stats.byTag["no-website"] ?? 0}
          hint="The strongest opening — nothing to defend."
        />
        <StatTile
          label="Not checked yet"
          value={stats.byTag.unclassified ?? 0}
          hint="Enrichment still running or switched off."
        />
      </div>

      {/* Filters. Plain links and a GET form, so every view is a shareable URL
          and the page works with JavaScript disabled. */}
      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <form
          method="GET"
          action="/admin/customers"
          className="flex flex-wrap gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Search name, city, email, or website"
            aria-label="Search customers"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-11 min-w-56 flex-1 rounded-xl border px-4 text-base shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm"
          />
          {/* Carried through so searching does not silently drop the other
              filters the operator already set. */}
          {status && status !== "all" && (
            <input type="hidden" name="status" value={status} />
          )}
          {tag && tag !== "all" && (
            <input type="hidden" name="tag" value={tag} />
          )}
          {city && <input type="hidden" name="city" value={city} />}
          {searchId && <input type="hidden" name="searchId" value={searchId} />}
          {emailOnly && <input type="hidden" name="emailOnly" value="1" />}
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <FilterRow label="Why they need you">
          <FilterChip
            href={buildHref({ tag: undefined, page: undefined })}
            active={!tag || tag === "all"}
          >
            All
          </FilterChip>
          {tagCounts.map(([key, count]) => (
            <FilterChip
              key={key}
              href={buildHref({ tag: key, page: undefined })}
              active={tag === key}
            >
              {PROSPECT_TAG_LABELS[key as ProspectTag] ?? key}
              <Badge variant="muted" className="ml-1 px-1.5 py-0">
                {count}
              </Badge>
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Stage">
          <FilterChip
            href={buildHref({ status: undefined, page: undefined })}
            active={!status || status === "all"}
          >
            All
          </FilterChip>
          {PROSPECT_PIPELINE.filter((entry) => stats.byStatus[entry]).map(
            (entry) => (
              <FilterChip
                key={entry}
                href={buildHref({ status: entry, page: undefined })}
                active={status === entry}
              >
                {PROSPECT_STATUS_LABELS[entry]}
                <Badge variant="muted" className="ml-1 px-1.5 py-0">
                  {stats.byStatus[entry]}
                </Badge>
              </FilterChip>
            ),
          )}
        </FilterRow>

        {cities.length > 1 && (
          <FilterRow label="City">
            <FilterChip
              href={buildHref({ city: undefined, page: undefined })}
              active={!city}
            >
              All
            </FilterChip>
            {stats.topCities.map((entry) => (
              <FilterChip
                key={entry.city}
                href={buildHref({ city: entry.city, page: undefined })}
                active={city === entry.city}
              >
                {entry.city}
                <Badge variant="muted" className="ml-1 px-1.5 py-0">
                  {entry.count}
                </Badge>
              </FilterChip>
            ))}
          </FilterRow>
        )}

        <FilterRow label="Options">
          <FilterChip
            href={buildHref({
              emailOnly: emailOnly ? undefined : "1",
              page: undefined,
            })}
            active={emailOnly}
          >
            Has an email
          </FilterChip>
          <FilterChip
            href={buildHref({ sort: "score", page: undefined })}
            active={!sort || sort === "score"}
          >
            Best opportunity
          </FilterChip>
          <FilterChip
            href={buildHref({ sort: "recent", page: undefined })}
            active={sort === "recent"}
          >
            Recently updated
          </FilterChip>
          <FilterChip
            href={buildHref({ sort: "name", page: undefined })}
            active={sort === "name"}
          >
            Name
          </FilterChip>
        </FilterRow>

        {searchId && (
          <p className="text-muted-foreground text-sm">
            Showing one discovery run only.{" "}
            <Link
              href={buildHref({ searchId: undefined, page: undefined })}
              className="text-primary underline-offset-2 hover:underline"
            >
              Show all customers
            </Link>
          </p>
        )}
      </section>

      <ProspectTable rows={rows} canManage={canManage} canEmail={canEmail} />

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
