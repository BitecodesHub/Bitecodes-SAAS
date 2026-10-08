import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ScrollText } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { getRouting, listProviderViews } from "@/lib/server/desktop/providers";
import { desktopLogStats } from "@/lib/server/desktop/logs";
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
  const [providers, routing, stats] = await Promise.all([
    listProviderViews(),
    getRouting(),
    desktopLogStats(),
  ]);

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
          <Button asChild variant="outline">
            <Link href="/admin/desktop/logs">
              <ScrollText aria-hidden="true" /> Prompt log
            </Link>
          </Button>
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

      <DesktopProviderAdmin
        providers={providers}
        routing={routing}
        regions={BEDROCK_REGIONS}
      />
    </div>
  );
}
