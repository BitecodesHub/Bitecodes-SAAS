"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runBootstrapAction } from "@/lib/server/admin/bootstrap-actions";
import type { BootstrapReport } from "@/lib/server/bootstrap";

/**
 * Observable, reversible first boot.
 *
 * Dry run is the default action offered first: it reads the database, reports
 * exactly which records are missing, and writes nothing. The live reconcile is
 * idempotent and never overwrites a stored setting or a human-edited template,
 * which is what makes the same button safe to press twice.
 */
export function BootstrapPanel() {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<BootstrapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDryRun, setLastDryRun] = useState<boolean | null>(null);

  function run(dryRun: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await runBootstrapAction({ dryRun, force: false });
      setLastDryRun(dryRun);
      if (result.report) setReport(result.report);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="text-primary size-4" />
            Autonomous bootstrap
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
            Runs automatically at server start and on the daily cron heartbeat.
            It creates the settings document, the default standing searches,
            templates, sequences, and chatbot models on an empty database, and
            never overwrites a value you have edited. A dry run writes nothing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => run(true)}
            disabled={pending}
          >
            {pending && lastDryRun ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FlaskConical className="size-4" />
            )}
            Dry run
          </Button>
          <Button onClick={() => run(false)} disabled={pending}>
            {pending && lastDryRun === false ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Reconcile now
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Summary
              label="Result"
              value={
                report.ok
                  ? report.dryRun
                    ? "Dry run clean"
                    : "Reconciled"
                  : "Errors"
              }
              tone={report.ok ? "ok" : "bad"}
            />
            <Summary
              label="Mode"
              value={report.dryRun ? "Dry run (no writes)" : report.source}
            />
            <Summary
              label="Settings"
              value={
                report.settings.created
                  ? "Created"
                  : report.settings.wouldCreate
                    ? "Would create"
                    : "Preserved"
              }
            />
            <Summary
              label="Standing searches"
              value={`${report.presets.present}/${report.presets.total}${
                report.presets.created
                  ? ` (${report.presets.created} created)`
                  : report.presets.wouldCreate
                    ? ` (${report.presets.wouldCreate} would be created)`
                    : ""
              }`}
            />
            <Summary
              label="Seeds"
              value={`${report.seeds.templatesInserted} template(s), ${report.seeds.sequencesInserted} sequence(s) inserted`}
            />
            <Summary
              label="Schedule"
              value={
                report.schedules.ok
                  ? `${report.schedules.total} healthy`
                  : `${report.schedules.missingHandlers.length} missing handler(s)`
              }
              tone={report.schedules.ok ? "ok" : "bad"}
            />
            <Summary
              label="Outbound gate"
              value={report.gates.state}
              tone={report.gates.state === "open" ? "warn" : "ok"}
            />
          </div>

          <details className="text-muted-foreground">
            <summary className="cursor-pointer text-xs font-medium">
              {report.actions.length} step(s) ·{" "}
              {new Date(report.finishedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
            </summary>
            <ul className="mt-2 space-y-1 text-xs">
              {report.actions.map((action, index) => (
                <li key={`${action.area}-${index}`}>
                  <span className="text-foreground font-medium">
                    {action.area}/{action.action}:
                  </span>{" "}
                  {action.detail}
                </li>
              ))}
            </ul>
          </details>

          {report.errors.length > 0 && (
            <ul className="list-inside list-disc space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
              {report.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "warn";
}) {
  const colour =
    tone === "bad"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "ok"
          ? "text-green-700"
          : "";
  return (
    <span className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className={`font-medium ${colour}`}>{value}</span>
    </span>
  );
}
