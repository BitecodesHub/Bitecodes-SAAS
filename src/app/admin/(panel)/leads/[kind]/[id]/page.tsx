import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, Mail } from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import { adminUsers } from "@/lib/server/db/collections";
import { getLead } from "@/lib/server/leads/repository";
import {
  humanizeFieldKey,
  LEAD_KIND_LABELS,
  LEAD_STATUS_LABELS,
  type LeadKind,
} from "@/lib/leads/display";
import { LeadDetailPanel } from "@/components/admin/lead-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import type { ActivityNote, LeadStatus } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Lead" };

export const dynamic = "force-dynamic";

const KINDS: LeadKind[] = ["enquiry", "consultant", "audit"];

interface PageProps {
  params: Promise<{ kind: string; id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  await requireCapability("manage_leads");
  const { kind, id } = await params;

  if (!KINDS.includes(kind as LeadKind)) notFound();
  const leadKind = kind as LeadKind;

  const lead = await getLead(leadKind, id);
  if (!lead) notFound();

  const canEmail = await hasCapability("send_email");
  const team = await loadTeam();

  const view = describeLead(lead);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/leads">
            <ArrowLeft className="size-4" />
            All leads
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {view.title}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {view.email && (
              <a
                href={`mailto:${view.email}`}
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Mail className="size-4" />
                {view.email}
              </a>
            )}
            {view.company && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" />
                {view.company}
              </span>
            )}
            <span>
              Received{" "}
              {view.createdAt.toLocaleString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{LEAD_KIND_LABELS[leadKind]}</Badge>
          <Badge>{LEAD_STATUS_LABELS[view.status]}</Badge>
          {view.reference && <Badge variant="muted">{view.reference}</Badge>}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {view.sections.map((section) => (
            <section
              key={section.heading}
              className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
            >
              <h2 className="text-base font-semibold">{section.heading}</h2>
              {section.body && (
                // Submitted text is rendered as plain text, never as HTML: this
                // is untrusted input from a public form.
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </p>
              )}
              {section.rows && section.rows.length > 0 && (
                <dl className="divide-border mt-3 divide-y text-sm">
                  {section.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start justify-between gap-4 py-2"
                    >
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="max-w-[60%] text-right font-medium break-words">
                        {row.href ? (
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1 underline underline-offset-2"
                          >
                            {row.value}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          row.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}

          {view.notes.length > 0 && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">Activity</h2>
              <ul className="divide-border mt-3 divide-y">
                {[...view.notes]
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

        <LeadDetailPanel
          kind={leadKind}
          id={id}
          status={view.status}
          email={view.email}
          name={view.name}
          assignedToId={view.assignedToId}
          team={team}
          canEmail={canEmail}
          defaultSubject={view.defaultSubject}
        />
      </div>
    </div>
  );
}

async function loadTeam(): Promise<Array<{ id: string; name: string }>> {
  try {
    const users = await adminUsers();
    const rows = await users
      .find(
        { status: "active" },
        { projection: { name: 1, email: 1 }, limit: 50 },
      )
      .toArray();
    return rows.map((row) => ({
      id: row._id!.toHexString(),
      name: row.name || row.email,
    }));
  } catch {
    // The assignment dropdown is a convenience; the page must still render.
    return [];
  }
}

interface DetailSection {
  heading: string;
  body?: string;
  rows?: Array<{ label: string; value: string; href?: string }>;
}

interface LeadView {
  title: string;
  name: string | null;
  email: string | null;
  company: string | null;
  reference: string | null;
  status: LeadStatus;
  assignedToId: string | null;
  createdAt: Date;
  notes: ActivityNote[];
  sections: DetailSection[];
  defaultSubject: string;
}

/**
 * Flattens each lead shape into one view model.
 *
 * Done here rather than in the repository because it is presentation: the three
 * sources genuinely carry different information, and the point of the detail
 * page is to show what is actually useful about each — the consultant's quote,
 * the audit's scores — rather than the lowest common denominator.
 */
function describeLead(
  lead: NonNullable<Awaited<ReturnType<typeof getLead>>>,
): LeadView {
  if (lead.kind === "enquiry") {
    const doc = lead.doc;
    return {
      title: doc.name,
      name: doc.name,
      email: doc.email,
      company: doc.company,
      reference: doc.reference,
      status: doc.status,
      assignedToId: doc.assignedToId ?? null,
      createdAt: doc.createdAt,
      notes: doc.notes ?? [],
      defaultSubject: `Re: your enquiry to ${siteConfig.name}`,
      sections: [
        { heading: "Their message", body: doc.message },
        {
          heading: "Details",
          rows: [
            { label: "Budget", value: doc.budget || "Not specified" },
            { label: "Role", value: doc.role || "Not given" },
            { label: "Source", value: doc.source },
            { label: "Acknowledgement email", value: doc.emailStatus },
          ],
        },
      ],
    };
  }

  if (lead.kind === "consultant") {
    const doc = lead.doc;
    const input = doc.input as Record<string, unknown>;
    const name = readString(input.name);

    return {
      title: name ?? doc.email ?? "AI consultant brief",
      name,
      email: doc.email ?? readString(input.email),
      company: readString(input.company),
      reference: doc.reference,
      status: doc.status,
      assignedToId: doc.assignedToId ?? null,
      createdAt: doc.createdAt,
      notes: doc.notes ?? [],
      defaultSubject: `Re: your project brief with ${siteConfig.name}`,
      sections: [
        {
          heading: "Their brief",
          body: readString(input.description) ?? "No description given.",
        },
        {
          heading: "What they selected",
          rows: Object.entries(input)
            .filter(
              ([key]) =>
                !["name", "email", "company", "description"].includes(key),
            )
            .map(([key, value]) => ({
              label: humanizeFieldKey(key),
              value: readDisplay(value),
            })),
        },
        {
          heading: "Quote we showed them",
          rows: doc.quote
            ? Object.entries(doc.quote).map(([key, value]) => ({
                label: humanizeFieldKey(key),
                value: readDisplay(value),
              }))
            : [{ label: "Quote", value: "Not produced" }],
        },
      ],
    };
  }

  const doc = lead.doc;
  const scores = doc.result?.scores ?? {};
  return {
    title: doc.hostname || doc.auditedUrl,
    name: null,
    email: doc.email,
    company: null,
    reference: doc.requestId,
    status: doc.status ?? "new",
    assignedToId: doc.assignedToId ?? null,
    createdAt: doc.createdAt,
    notes: doc.notes ?? [],
    defaultSubject: `Your ${doc.hostname || "website"} review from ${siteConfig.name}`,
    sections: [
      {
        heading: "What they audited",
        rows: [
          {
            label: "URL",
            value: doc.auditedUrl,
            href: doc.auditedUrl,
          },
          {
            label: "Overall score",
            value: String(doc.result?.overallScore ?? "—"),
          },
          ...Object.entries(scores).map(([key, value]) => ({
            label: humanizeFieldKey(key),
            value: String(value),
          })),
          {
            label: "Response time",
            value: `${doc.result?.responseTimeMs ?? "—"} ms`,
          },
        ],
      },
    ],
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Renders any brief field for display without ever emitting HTML. */
function readDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(readDisplay).join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
