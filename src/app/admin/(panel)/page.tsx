import { Suspense } from "react";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { getDashboardData } from "@/lib/server/admin/dashboard";
import { runHealthChecks } from "@/lib/server/admin/health";
import { StatTile, LineChart, BarChart } from "@/components/ui/chart";
import { HealthPanel } from "@/components/admin/health-panel";
import { ActivityFeed } from "@/components/admin/activity-feed";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The admin dashboard.
 *
 * Rendered on demand rather than cached: an operator opening this page wants the
 * current state, and a cached dashboard that shows yesterday's queue depth is
 * actively misleading.
 *
 * The health panel is streamed behind its own Suspense boundary because it makes
 * live network round trips to SMTP, OpenRouter, and Overpass — one slow provider
 * would otherwise hold up the numbers, which are the reason someone came here.
 */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireCapability("view");
  const data = await getDashboardData();

  const queueEntries = Object.entries(data.queue)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      label: status,
      value: count,
      color:
        status === "failed"
          ? "var(--chart-critical)"
          : status === "queued" || status === "running"
            ? "var(--chart-1)"
            : "var(--chart-3)",
    }));

  return (
    <div className="space-y-6">
      {data.degraded.length > 0 && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-2xl border p-4 text-sm"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p className="leading-relaxed">
            Some figures could not be loaded ({data.degraded.join(", ")}). They
            are shown as zero rather than omitted — treat them as unknown.
          </p>
        </div>
      )}

      {/* Exactly one hero figure per view. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label="Enquiries (30 days)"
          value={data.leads.current}
          previous={data.leads.previous}
          comparisonLabel="vs previous 30 days"
          trend={data.leadTrend.values}
        />
        <StatTile
          label="Prospects"
          value={data.prospectCount}
          hint="Businesses discovered on the map."
        />
        <StatTile
          label="Emails sent (30 days)"
          value={data.emailsSent.current}
          previous={data.emailsSent.previous}
          comparisonLabel="vs previous 30 days"
        />
        <StatTile
          label="Free tool runs (30 days)"
          value={data.auditRuns.current + data.consultantRuns.current}
          previous={data.auditRuns.previous + data.consultantRuns.previous}
          comparisonLabel="vs previous 30 days"
          hint="Website audits and AI consultant briefs."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)] xl:col-span-2">
          <LineChart
            title="Enquiries per day"
            labels={data.leadTrend.labels}
            series={[{ name: "Enquiries", values: data.leadTrend.values }]}
          />
        </div>

        <div className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <BarChart title="Background queue" data={queueEntries} />
          {queueEntries.length === 0 && (
            <p className="text-muted-foreground mt-3 text-sm">
              Nothing queued. Automation starts once prospects or outreach
              exist.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Suspense fallback={<HealthPanelSkeleton />}>
          <HealthPanelSection />
        </Suspense>

        <ActivityFeed entries={data.recentActivity} />
      </div>
    </div>
  );
}

async function HealthPanelSection() {
  const checks = await runHealthChecks();
  return <HealthPanel checks={checks} />;
}

function HealthPanelSkeleton() {
  return (
    <div
      role="status"
      aria-label="Checking system health"
      className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="bg-muted h-5 w-32 animate-pulse rounded" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <div className="bg-muted size-4 shrink-0 animate-pulse rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-muted h-3.5 w-1/3 animate-pulse rounded" />
              <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
