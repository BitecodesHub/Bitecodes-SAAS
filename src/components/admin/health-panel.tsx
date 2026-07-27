import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  XCircle,
} from "lucide-react";
import type { HealthCheck, HealthStatus } from "@/lib/server/admin/health";
import { cn } from "@/lib/utils";

/**
 * System health panel.
 *
 * Status is never carried by colour alone — each row has an icon and a written
 * status, so it reads correctly in greyscale, in forced-colours mode, and for a
 * colourblind operator.
 */

const ICONS: Record<HealthStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
  "not-configured": CircleDashed,
};

const COLORS: Record<HealthStatus, string> = {
  ok: "text-[var(--chart-good)]",
  warn: "text-[var(--chart-warning)]",
  fail: "text-destructive",
  "not-configured": "text-muted-foreground",
};

const LABELS: Record<HealthStatus, string> = {
  ok: "OK",
  warn: "Warning",
  fail: "Failing",
  "not-configured": "Not set up",
};

export function HealthPanel({ checks }: { checks: HealthCheck[] }) {
  return (
    <section
      aria-labelledby="health-heading"
      className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 id="health-heading" className="font-semibold tracking-tight">
        System health
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Checked live on every load, not read from configuration.
      </p>

      <ul className="mt-4 space-y-3">
        {checks.map((check) => {
          const Icon = ICONS[check.status];
          return (
            <li key={check.name} className="flex items-start gap-3">
              <Icon
                aria-hidden="true"
                className={cn("mt-0.5 size-4 shrink-0", COLORS[check.status])}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  {check.name}
                  {/* Written status, so the icon is not the only signal. */}
                  <span
                    className={cn("text-xs font-normal", COLORS[check.status])}
                  >
                    {LABELS[check.status]}
                  </span>
                  {check.latencyMs !== undefined && (
                    <span className="text-muted-foreground text-xs font-normal [font-variant-numeric:tabular-nums]">
                      {check.latencyMs} ms
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed break-words">
                  {check.detail}
                </p>
                {check.remedy && (
                  <p className="text-foreground/80 mt-1 text-sm leading-relaxed">
                    {check.remedy}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
