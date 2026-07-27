import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
} from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { getProspect } from "@/lib/server/prospecting/repository";
import { buildObservations } from "@/lib/prospecting/report";
import {
  PROSPECT_STATUS_LABELS,
  scoreBand,
  shortUrl,
  tagBadgeVariant,
  tagLabel,
} from "@/lib/prospecting/display";
import { OSM_ATTRIBUTION } from "@/lib/prospecting/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProspectDetailPanel } from "@/components/admin/prospect-detail-panel";

export const metadata: Metadata = { title: "Customer" };

/** Rendered per request: enrichment may land while this page is open. */
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProspectDetailPage({ params }: PageProps) {
  await requireCapability("manage_prospects");
  const { id } = await params;

  const prospect = await getProspect(id);
  if (!prospect) notFound();

  const classification = prospect.classification;
  const band = scoreBand(classification?.score);
  const observations = buildObservations(prospect.signals);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/customers">
            <ArrowLeft className="size-4" />
            All customers
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {prospect.name}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {prospect.categoryLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" />
                {prospect.categoryLabel}
              </span>
            )}
            {(prospect.address || prospect.city) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {[prospect.address, prospect.city, prospect.region]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
            {prospect.phone && (
              <a
                href={`tel:${prospect.phone}`}
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Phone className="size-4" />
                {prospect.phone}
              </a>
            )}
            {prospect.website ? (
              <a
                href={prospect.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Globe className="size-4" />
                {shortUrl(prospect.website)}
                <ExternalLink className="size-3" />
              </a>
            ) : prospect.socialUrl ? (
              <a
                href={prospect.socialUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Globe className="size-4" />
                social page only
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4 opacity-40" />
                no website
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tagBadgeVariant(classification?.primaryTag)}>
            {tagLabel(classification?.primaryTag)}
          </Badge>
          <Badge variant="secondary">
            {PROSPECT_STATUS_LABELS[prospect.status]}
          </Badge>
          {typeof classification?.score === "number" && (
            <Badge variant="outline">
              {band.label} · {classification.score}
            </Badge>
          )}
        </div>
      </header>

      {prospect.enrichmentError && !classification && (
        <div
          role="status"
          className="border-border bg-muted/40 rounded-2xl border p-4 text-sm leading-relaxed"
        >
          <p className="font-medium">This website has not been checked yet.</p>
          <p className="text-muted-foreground mt-1">
            {prospect.enrichmentError}
          </p>
          <p className="text-muted-foreground mt-1">
            No verdict is recorded, so this customer is excluded from outreach
            until a check succeeds. Use “Re-check website” to try again.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {classification && (
            <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">Why they need you</h2>
              <ul className="space-y-2">
                {classification.topIssues.map((issue) => (
                  <li key={issue} className="flex gap-2 text-sm">
                    <span aria-hidden="true" className="text-muted-foreground">
                      •
                    </span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>

              <h3 className="pt-2 text-sm font-semibold">
                How to open the conversation
              </h3>
              <ol className="space-y-2">
                {classification.pitchAngles.map((angle, index) => (
                  <li key={angle} className="flex gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="bg-muted text-muted-foreground mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold"
                    >
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {angle}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {observations.length > 0 && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">What the check found</h2>
              <dl className="divide-border mt-3 divide-y text-sm">
                {observations.map((observation) => (
                  <div
                    key={observation.label}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <dt className="text-muted-foreground">
                      {observation.label}
                    </dt>
                    <dd
                      className="font-medium"
                      style={{
                        color:
                          observation.ok === false
                            ? "var(--chart-critical)"
                            : observation.ok === true
                              ? "var(--chart-3)"
                              : undefined,
                      }}
                    >
                      {observation.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {typeof prospect.auditScore === "number" && (
                <p className="text-muted-foreground mt-3 text-xs">
                  Overall audit score {prospect.auditScore}/100.
                </p>
              )}
            </section>
          )}

          {prospect.notes && prospect.notes.length > 0 && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">Notes</h2>
              <ul className="divide-border mt-3 divide-y">
                {[...prospect.notes]
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                  .map((note) => (
                    <li key={note.id} className="py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {note.body}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {note.authorName} ·{" "}
                        {note.createdAt.toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>

        <ProspectDetailPanel
          prospectId={id}
          email={prospect.email}
          emailSource={prospect.emailSource}
          status={prospect.status}
          canReport={Boolean(classification)}
          contactCount={prospect.contactCount}
          lastContactedAt={prospect.lastContactedAt?.toISOString() ?? null}
          tags={prospect.tags}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Business details from OpenStreetMap ({OSM_ATTRIBUTION}), source{" "}
        <code className="text-[11px]">{prospect.sourceId}</code>. Website checks
        are passive — one public page request, no scanning, no logins.
      </p>
    </div>
  );
}
