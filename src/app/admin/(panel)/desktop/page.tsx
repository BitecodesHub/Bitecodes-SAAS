import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ScrollText } from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import { getRouting, listProviderViews } from "@/lib/server/desktop/providers";
import { desktopLogStats } from "@/lib/server/desktop/logs";
import { getLimits, usageToday } from "@/lib/server/desktop/quota";
import { desktopHealth } from "@/lib/server/desktop/alerts";
import { DesktopLimitsCard } from "@/components/admin/desktop-limits-card";
import { DesktopReleaseCard } from "@/components/admin/desktop-release-card";
import { getRelease } from "@/lib/server/desktop/release";
import { BEDROCK_REGIONS } from "@/lib/bedrock-regions";
import { DesktopProviderAdmin } from "@/components/admin/desktop-provider-admin";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Desktop app" };
export const dynamic = "force-dynamic";

/**
 * Operator control for the desktop app's hidden "Bitecodes model": which
 * upstream providers it may use, their keys and models, and the default +
 * fallback order. Desktop users never see any of this.
 */
export default async function DesktopAdminPage() {
  await requireCapability("manage_settings");
  const canReadPrompts = await hasCapability("view_desktop_prompts");
  const [providers, routing, stats, limits, today, health, release] =
    await Promise.all([
      listProviderViews(),
      getRouting(),
      desktopLogStats(),
      getLimits(),
      usageToday(),
      desktopHealth(),
      getRelease(),
    ]);
  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })
      : "never";
  const errorRate1h = health.requests1h
    ? health.errors1h / health.requests1h
    : 0;
  const status = !routing.enabled
    ? { label: "Switched off", tone: "text-muted-foreground" }
    : health.requests1h >= 5 && errorRate1h >= 0.5
      ? { label: "Degraded", tone: "text-red-600" }
      : health.errors1h > 0
        ? { label: "Some errors", tone: "text-amber-600" }
        : { label: "Healthy", tone: "text-emerald-600" };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Desktop app</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Desktop users sign in with their Bitecodes account and get one
            option: the Bitecodes model. You choose what it runs on. Keys are
            stored encrypted and are never shown again after saving.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/desktop/activity">
              <Activity aria-hidden="true" /> Users &amp; activity
            </Link>
          </Button>
          {canReadPrompts && (
            <Button asChild variant="outline">
              <Link href="/admin/desktop/logs">
                <ScrollText aria-hidden="true" /> Prompt log
              </Link>
            </Button>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Requests (24h)", stats.total24h.toLocaleString()],
          ["Errors (24h)", stats.errors24h.toLocaleString()],
          ["Active users (24h)", stats.users24h.toLocaleString()],
          [
            "Avg latency (24h)",
            stats.avgLatencyMs24h != null
              ? `${(stats.avgLatencyMs24h / 1000).toFixed(1)}s`
              : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-card rounded-lg border p-4">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section
        className="bg-card rounded-lg border p-5"
        aria-labelledby="health-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="health-heading" className="font-semibold">
            Health
          </h2>
          <span className={`text-sm font-medium ${status.tone}`}>
            {status.label}
          </span>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Last answered</dt>
            <dd>{fmt(health.lastSuccessAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Last failure</dt>
            <dd>{fmt(health.lastFailureAt)}</dd>
            {health.lastFailure && (
              <dd className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                {health.lastFailure}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Last hour</dt>
            <dd className="tabular-nums">
              {health.errors1h} failed of {health.requests1h}
            </dd>
          </div>
        </dl>
        {health.providers24h.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <caption className="text-muted-foreground mb-1 text-left text-xs">
              Provider attempts, last 24 hours
            </caption>
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 text-right font-medium">Attempts</th>
                <th className="py-1 text-right font-medium">Failed</th>
                <th className="py-1 pl-4 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody>
              {health.providers24h.map((p) => (
                <tr key={p.provider} className="border-t">
                  <td className="py-1.5 font-medium">{p.provider}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {p.attempts}
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${p.failed ? "text-red-600" : ""}`}
                  >
                    {p.failed}
                  </td>
                  <td className="text-muted-foreground max-w-md truncate py-1.5 pl-4 text-xs">
                    {p.lastError ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-muted-foreground mt-3 text-xs">
          Alerts are emailed to the site notification address when every
          provider fails or half of requests fail in 15 minutes.
          {health.lastAlert
            ? ` Last alert: ${health.lastAlert.kind.replace("_", " ")} at ${fmt(health.lastAlert.at)}.`
            : " No alerts sent yet."}
        </p>
      </section>

      <DesktopLimitsCard limits={limits} today={today} />

      <DesktopReleaseCard release={release} />

      <DesktopProviderAdmin
        providers={providers}
        routing={routing}
        regions={BEDROCK_REGIONS}
      />
    </div>
  );
}
