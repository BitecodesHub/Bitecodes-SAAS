import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Mail,
  Sparkles,
  Target,
} from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import { adminUsers, sequenceEnrollments } from "@/lib/server/db/collections";
import {
  getLead,
  listLeadActivities,
  submissionField,
} from "@/lib/server/leads/repository";
import {
  humanizeFieldKey,
  LEAD_KIND_LABELS,
  LEAD_STAGE_LABELS,
  type LeadGrade,
  type LeadKind,
  type LeadStage,
} from "@/lib/leads/display";
import { LeadDetailPanel } from "@/components/admin/lead-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import type {
  ActivityNote,
  LeadActivityDoc,
  LeadQualification,
} from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Lead" };

export const dynamic = "force-dynamic";

const KINDS: LeadKind[] = ["enquiry", "consultant", "audit", "form", "booking"];

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

  const [canEmail, team, activities, enrollment] = await Promise.all([
    hasCapability("send_email"),
    loadTeam(),
    listLeadActivities(leadKind, id).catch(() => [] as LeadActivityDoc[]),
    findActiveEnrollment(leadKind, id),
  ]);

  const view = describeLead(lead, activities);
  const readOnly = lead.kind === "form" || lead.kind === "booking";

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
          <Badge>{LEAD_STAGE_LABELS[view.stage]}</Badge>
          {view.grade && (
            <Badge variant={view.grade === "A" ? "default" : "secondary"}>
              {view.grade} · {view.score}/100
            </Badge>
          )}
          {view.reference && <Badge variant="muted">{view.reference}</Badge>}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {(view.score !== null || view.qualification) && (
            <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Target className="size-4" />
                  Lead quality
                </h2>
                {view.score !== null && (
                  <span className="text-muted-foreground text-sm">
                    <span className="text-foreground text-xl font-semibold tabular-nums">
                      {view.score}
                    </span>
                    /100
                  </span>
                )}
              </div>

              {view.scoreReasons.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {view.scoreReasons.map((reason) => (
                    <li key={reason}>
                      <Badge variant="muted" className="font-normal">
                        {reason}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}

              {view.qualification && (
                <div className="border-border mt-4 space-y-3 border-t pt-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="size-3.5" />
                    AI qualification
                  </h3>
                  <p className="text-sm leading-relaxed">
                    {view.qualification.summary}
                  </p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground text-xs">Need</dt>
                      <dd>{view.qualification.need}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        Budget signal
                      </dt>
                      <dd>{view.qualification.budgetSignal}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        Timeline
                      </dt>
                      <dd>{view.qualification.timeline}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        Suggested service
                      </dt>
                      <dd>{view.qualification.suggestedService}</dd>
                    </div>
                  </dl>
                  <p className="text-muted-foreground text-xs">
                    Suggested next step:{" "}
                    {view.qualification.suggestedNextAction} ·{" "}
                    {view.qualification.provider}/{view.qualification.model}
                  </p>
                </div>
              )}
            </section>
          )}

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

          <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold">Timeline</h2>
            {view.timeline.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Nothing recorded yet. Replies, notes, sends, opens, clicks, and
                score changes appear here.
              </p>
            ) : (
              <ol className="divide-border mt-3 divide-y">
                {view.timeline.map((entry) => (
                  <li key={entry.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium tracking-wide uppercase">
                        {entry.label}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {entry.at.toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                      {entry.body}
                    </p>
                    {entry.author && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {entry.author}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <LeadDetailPanel
          kind={leadKind}
          id={id}
          stage={view.stage}
          email={view.email}
          name={view.name}
          assignedToId={view.assignedToId}
          team={team}
          canEmail={canEmail}
          defaultSubject={view.defaultSubject}
          readOnly={readOnly}
          nextAction={view.nextAction}
          nextActionDate={toDateInput(view.nextActionAt)}
          ownerNotes={view.ownerNotes}
          consentMarketing={view.consentMarketing}
          enrolled={Boolean(enrollment)}
        />
      </div>
    </div>
  );
}

async function findActiveEnrollment(kind: LeadKind, id: string) {
  try {
    const collection = await sequenceEnrollments();
    return collection.findOne({
      leadKind: kind,
      leadId: id,
      status: "active",
    });
  } catch {
    return null;
  }
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

interface TimelineEntry {
  id: string;
  label: string;
  body: string;
  author?: string;
  at: Date;
}

interface LeadView {
  title: string;
  name: string | null;
  email: string | null;
  company: string | null;
  reference: string | null;
  stage: LeadStage;
  grade: LeadGrade | null;
  score: number | null;
  scoreReasons: string[];
  qualification: LeadQualification | null;
  nextAction: string | null;
  nextActionAt: Date | null;
  ownerNotes: string;
  consentMarketing: boolean;
  assignedToId: string | null;
  createdAt: Date;
  timeline: TimelineEntry[];
  sections: DetailSection[];
  defaultSubject: string;
}

function timelineFrom(
  notes: ActivityNote[],
  activities: LeadActivityDoc[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      label: "Note",
      body: note.body,
      author: note.authorName,
      at: note.createdAt,
    })),
    ...activities.map((activity) => ({
      id: `activity-${activity._id?.toHexString() ?? activity.createdAt.getTime()}`,
      label: humanizeFieldKey(activity.type),
      body: activity.summary,
      author: activity.actorId ? undefined : "System",
      at: activity.createdAt,
    })),
  ];
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/**
 * Flattens each lead shape into one view model.
 *
 * Done here rather than in the repository because it is presentation: the five
 * sources genuinely carry different information, and the point of the detail
 * page is to show what is actually useful about each — the consultant's quote,
 * the audit's scores, the form's raw fields — rather than the lowest common
 * denominator.
 */
function describeLead(
  lead: NonNullable<Awaited<ReturnType<typeof getLead>>>,
  activities: LeadActivityDoc[],
): LeadView {
  if (lead.kind === "enquiry") {
    const doc = lead.doc;
    return {
      title: doc.name,
      name: doc.name,
      email: doc.email,
      company: doc.company,
      reference: doc.reference,
      stage: doc.stage ?? legacyStage(doc.status),
      grade: doc.grade ?? null,
      score: doc.score ?? null,
      scoreReasons: doc.scoreReasons ?? [],
      qualification: doc.qualification ?? null,
      nextAction: doc.nextAction ?? null,
      nextActionAt: doc.nextActionAt ?? null,
      ownerNotes: doc.ownerNotes ?? "",
      consentMarketing: doc.consent?.marketing === true,
      assignedToId: doc.assignedToId ?? null,
      createdAt: doc.createdAt,
      timeline: timelineFrom(doc.notes ?? [], activities),
      defaultSubject: `Re: your enquiry to ${siteConfig.name}`,
      sections: [
        { heading: "Their message", body: doc.message },
        {
          heading: "Details",
          rows: [
            { label: "Budget", value: doc.budget || "Not specified" },
            { label: "Timeline", value: doc.timeline || "Not given" },
            { label: "Country", value: doc.country || "Not given" },
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
      stage: doc.stage ?? legacyStage(doc.status),
      grade: doc.grade ?? null,
      score: doc.score ?? null,
      scoreReasons: doc.scoreReasons ?? [],
      qualification: doc.qualification ?? null,
      nextAction: doc.nextAction ?? null,
      nextActionAt: doc.nextActionAt ?? null,
      ownerNotes: doc.ownerNotes ?? "",
      consentMarketing: doc.consent?.marketing === true,
      assignedToId: doc.assignedToId ?? null,
      createdAt: doc.createdAt,
      timeline: timelineFrom(doc.notes ?? [], activities),
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

  if (lead.kind === "audit") {
    const doc = lead.doc;
    const scores = doc.result?.scores ?? {};
    return {
      title: doc.hostname || doc.auditedUrl,
      name: null,
      email: doc.email,
      company: null,
      reference: doc.requestId,
      stage: doc.stage ?? legacyStage(doc.status ?? "new"),
      grade: doc.grade ?? null,
      score: doc.score ?? null,
      scoreReasons: doc.scoreReasons ?? [],
      qualification: doc.qualification ?? null,
      nextAction: doc.nextAction ?? null,
      nextActionAt: doc.nextActionAt ?? null,
      ownerNotes: doc.ownerNotes ?? "",
      consentMarketing: doc.consent?.marketing === true,
      assignedToId: doc.assignedToId ?? null,
      createdAt: doc.createdAt,
      timeline: timelineFrom(doc.notes ?? [], activities),
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

  if (lead.kind === "form") {
    const doc = lead.doc;
    const stage = legacyStage(
      doc.status === "spam"
        ? "spam"
        : doc.status === "archived"
          ? "lost"
          : "new",
    );
    return {
      title:
        submissionField(doc.data, /^(full_?name|name)$/) ?? "Form submission",
      name: submissionField(doc.data, /^(full_?name|name)$/),
      email: submissionField(doc.data, /e-?mail/),
      company: submissionField(doc.data, /company|organi[sz]ation|business/),
      reference: `FORM-${doc.submissionId.slice(0, 8).toUpperCase()}`,
      stage,
      grade: null,
      score: null,
      scoreReasons: [],
      qualification: null,
      nextAction: null,
      nextActionAt: null,
      ownerNotes: "",
      consentMarketing: false,
      assignedToId: null,
      createdAt: doc.createdAt,
      timeline: [],
      defaultSubject: `About your ${siteConfig.name} form submission`,
      sections: [
        {
          heading: "Submitted fields",
          rows: Object.entries(doc.data).map(([key, value]) => ({
            label: humanizeFieldKey(key),
            value: readDisplay(value),
          })),
        },
        {
          heading: "Submission details",
          rows: [
            { label: "Status", value: doc.status },
            { label: "Form", value: doc.formId },
            {
              label: "Referrer",
              value: doc.meta.referrer ?? "Direct",
              href: doc.meta.referrer ?? undefined,
            },
          ],
        },
      ],
    };
  }

  const doc = lead.doc;
  return {
    title: doc.customerName,
    name: doc.customerName,
    email: doc.customerEmail,
    company: null,
    reference: `BK-${doc.bookingId.slice(0, 8).toUpperCase()}`,
    stage: doc.status === "confirmed" ? "qualified" : "lost",
    grade: null,
    score: null,
    scoreReasons: [],
    qualification: null,
    nextAction: null,
    nextActionAt: null,
    ownerNotes: "",
    consentMarketing: false,
    assignedToId: null,
    createdAt: doc.createdAt,
    timeline: [],
    defaultSubject: `About your call with ${siteConfig.name}`,
    sections: [
      {
        heading: "Booking",
        rows: [
          {
            label: "Starts",
            value: `${doc.startAt.toLocaleString("en-GB", {
              timeZone: "UTC",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })} UTC`,
          },
          { label: "Status", value: doc.status },
          { label: "Phone", value: doc.customerPhone || "Not given" },
          { label: "Timezone", value: doc.meta.timezone || "Not given" },
        ],
      },
      ...(doc.notes ? [{ heading: "Their notes", body: doc.notes }] : []),
    ],
  };
}

function legacyStage(status: string): LeadStage {
  if (
    status === "contacted" ||
    status === "qualified" ||
    status === "proposal" ||
    status === "won"
  ) {
    return status;
  }
  if (status === "lost" || status === "spam") return "lost";
  return "new";
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
