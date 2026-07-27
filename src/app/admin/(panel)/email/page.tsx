import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PenLine, ShieldCheck } from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import { listTemplates } from "@/lib/server/email/templates";
import {
  getEmailStats,
  listEmailMessages,
  listPendingApproval,
} from "@/lib/server/email/inbox";
import {
  listSuppressions,
  countSuppressions,
} from "@/lib/server/email/suppression";
import {
  getEnrollmentStats,
  listSequences,
} from "@/lib/server/email/sequences";
import { getSettingsFresh } from "@/lib/server/settings";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";
import { ApprovalQueue } from "@/components/admin/approval-queue";
import { SuppressionManager } from "@/components/admin/suppression-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProspectTag } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Email" };

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  await requireCapability("send_email");

  const [
    templates,
    stats,
    pending,
    recent,
    suppressed,
    suppressionCount,
    settings,
    canEditTemplates,
    sequences,
    enrollmentStats,
  ] = await Promise.all([
    listTemplates(),
    getEmailStats(),
    listPendingApproval(50),
    listEmailMessages({ pageSize: 15 }),
    listSuppressions(25),
    countSuppressions(),
    getSettingsFresh(),
    hasCapability("manage_settings"),
    listSequences(),
    getEnrollmentStats(),
  ]);

  const postalMissing = !settings.contact.address.postal;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          One template per reason a customer needs you. Outreach waits for your
          approval before it leaves, unless you switch that off in settings.
        </p>
      </header>

      {/* Compliance blockers first: these stop mail leaving, so they belong
          above the numbers rather than buried in a settings page. */}
      {postalMissing && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-2xl border p-4 text-sm"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p className="leading-relaxed">
            No postal address is set. CAN-SPAM requires one in the footer of
            commercial email, so outreach will be refused until you add it under{" "}
            <Link
              href="/admin/settings"
              className="underline underline-offset-2"
            >
              Settings
            </Link>
            . Replies to leads are unaffected.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label="Awaiting your approval"
          value={stats.awaitingApproval}
          hint="Nothing here leaves until you approve it."
        />
        <StatTile label="Sent (7 days)" value={stats.sentLast7Days} />
        <StatTile
          label="Opened"
          value={stats.opened}
          hint="Open tracking is a rough signal; image blocking hides many."
        />
        <StatTile
          label="Clicked"
          value={stats.clicked}
          hint="A click is the real signal."
        />
      </div>

      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Automation</h2>
            <p className="text-muted-foreground text-sm">
              How outreach behaves right now.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/settings">Change</Link>
          </Button>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            label="Approval"
            value={
              settings.automation.requireApproval ? "Required" : "Not required"
            }
            tone={settings.automation.requireApproval ? "good" : "warning"}
          />
          <Fact
            label="Per-domain daily cap"
            value={String(settings.automation.perDomainDailyCap)}
          />
          <Fact
            label="Global daily cap"
            value={String(settings.automation.globalDailyCap)}
          />
          <Fact
            label="Consent regions"
            value={
              settings.automation.blockConsentRequiredRegions
                ? "EU and Canada blocked"
                : "Not blocked"
            }
            tone={
              settings.automation.blockConsentRequiredRegions
                ? "good"
                : "warning"
            }
          />
        </dl>
      </section>

      <ApprovalQueue messages={pending} />

      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="text-base font-semibold">Follow-up sequences</h2>
          <p className="text-muted-foreground text-sm">
            Enrol customers from the customers table. A sequence stops itself on
            a click, an unsubscribe, or as soon as you move the customer along
            the pipeline.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Fact label="Running" value={String(enrollmentStats.active)} />
          <Fact label="Finished" value={String(enrollmentStats.completed)} />
          <Fact
            label="Stopped early"
            value={String(enrollmentStats.stopped)}
            tone={enrollmentStats.stopped > 0 ? "good" : undefined}
          />
        </div>

        {Object.keys(enrollmentStats.byStopReason).length > 0 && (
          <p className="text-muted-foreground text-xs">
            Stopped because:{" "}
            {Object.entries(enrollmentStats.byStopReason)
              .map(([reason, count]) => `${count} ${reason.replace(/-/g, " ")}`)
              .join(", ")}
            .
          </p>
        )}

        <ul className="divide-border border-border divide-y rounded-xl border">
          {sequences.map((sequence) => (
            <li key={sequence.key} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{sequence.name}</span>
                {sequence.enabled ? (
                  <Badge variant="secondary">On</Badge>
                ) : (
                  <Badge variant="muted">Off</Badge>
                )}
                {sequence.stopOnClick && (
                  <Badge variant="outline">Stops on a click</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {sequence.description}
              </p>
              <p className="text-muted-foreground text-xs">
                {sequence.steps
                  .map((step, index) =>
                    index === 0
                      ? "First contact, matched to their tag, straight away"
                      : `then ${step.templateKey.replace("followup.", "")} after ${Math.round(step.delayHours / 24)} days`,
                  )
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Templates</h2>
            <p className="text-muted-foreground text-sm">
              One per classification tag. Editing a template protects it from
              future updates to the shipped default.
            </p>
          </div>
        </div>

        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead className="w-44">For customers tagged</TableHead>
                <TableHead className="w-28">State</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableEmpty colSpan={4}>No templates yet.</TableEmpty>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.key}>
                    <TableCell>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 max-w-md text-xs">
                        {template.subject}
                      </p>
                    </TableCell>
                    <TableCell>
                      {template.prospectTag ? (
                        <Badge variant="outline">
                          {PROSPECT_TAG_LABELS[
                            template.prospectTag as ProspectTag
                          ] ?? template.prospectTag}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {!template.enabled && (
                          <Badge variant="muted">Off</Badge>
                        )}
                        {template.isDefault ? (
                          <Badge variant="muted">Default</Badge>
                        ) : (
                          <Badge variant="secondary">Edited</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canEditTemplates ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/admin/email/templates/${encodeURIComponent(template.key)}`}
                          >
                            <PenLine className="size-4" />
                            Edit
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          View only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Recent email</h2>
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24">Signals</TableHead>
                <TableHead className="w-32">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.items.length === 0 ? (
                <TableEmpty colSpan={5}>
                  Nothing sent yet. Select customers under{" "}
                  <Link
                    href="/admin/customers"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Customers
                  </Link>{" "}
                  and choose Send email.
                </TableEmpty>
              ) : (
                recent.items.map((message) => (
                  <TableRow key={message.messageId}>
                    <TableCell>
                      <p className="text-sm">{message.to}</p>
                      {message.templateKey && (
                        <p className="text-muted-foreground text-xs">
                          {message.templateKey}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-1 max-w-sm text-sm">
                        {message.subject}
                      </p>
                      {message.lastError && (
                        <p className="text-destructive mt-0.5 line-clamp-1 text-xs">
                          {message.lastError}
                        </p>
                      )}
                      {message.skipReason && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Skipped: {message.skipReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          message.status === "sent"
                            ? "secondary"
                            : message.status === "failed"
                              ? "default"
                              : "muted"
                        }
                      >
                        {message.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-xs">
                        {message.openCount > 0 && `${message.openCount} open`}
                        {message.openCount > 0 &&
                          message.clickCount > 0 &&
                          " · "}
                        {message.clickCount > 0 &&
                          `${message.clickCount} click`}
                        {message.openCount === 0 &&
                          message.clickCount === 0 &&
                          "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <time
                        dateTime={message.createdAt.toISOString()}
                        className="text-muted-foreground text-xs"
                      >
                        {message.createdAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </time>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <SuppressionManager
        entries={suppressed.map((entry) => ({
          value: entry.value,
          reason: entry.reason,
          detail: entry.detail,
          createdAt: entry.createdAt.toISOString(),
        }))}
        total={suppressionCount}
        canRemove={canEditTemplates}
      />

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Every outreach email carries a one-click unsubscribe honoured by{" "}
          <code className="text-[11px]">/api/unsubscribe</code>, which accepts
          the POST that Gmail and Yahoo send on a recipient&rsquo;s behalf.
          Suppression is permanent and checked before every send.
        </span>
      </p>
    </div>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warning";
}) {
  return (
    <div className="border-border bg-muted/30 rounded-xl border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className="mt-0.5 font-medium"
        style={{
          color:
            tone === "warning"
              ? "var(--chart-4)"
              : tone === "good"
                ? "var(--chart-3)"
                : undefined,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
