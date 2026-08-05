import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { getSettings } from "@/lib/server/settings";
import { listProspectSearches } from "@/lib/server/prospecting/repository";
import { listAutopilotPresets } from "@/lib/server/autopilot";
import { DiscoveryConsole } from "@/components/admin/discovery-console";
import { AutopilotPanel } from "@/components/admin/autopilot-panel";
import { OSM_ATTRIBUTION } from "@/lib/prospecting/categories";

export const metadata: Metadata = { title: "Grab new customers" };

/**
 * Rendered per request: the recent-runs list must reflect the run the operator
 * started thirty seconds ago, and a cached copy of this page would show a stale
 * history the moment it mattered most.
 */
export const dynamic = "force-dynamic";

/**
 * Where the map opens when there is no history.
 *
 * The studio's own city, so a first-time operator sees streets rather than
 * ocean. Overridden by the most recent search below.
 */
const DEFAULT_CENTER = { lat: 23.0225, lng: 72.5714 };

export default async function DiscoverPage() {
  await requireCapability("manage_prospects");

  const [settings, recentSearches, presets] = await Promise.all([
    getSettings(),
    listProspectSearches(6),
    listAutopilotPresets(),
  ]);

  // Reopen where the operator last worked. Coming back to the same area is far
  // more common than starting somewhere new.
  const lastSearch = recentSearches[0];
  const initialCenter = lastSearch
    ? { lat: lastSearch.lat, lng: lastSearch.lng }
    : DEFAULT_CENTER;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Grab new customers
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Pick an area on the map and the kinds of business you want. Every
          named business in that area is checked — whether it has a website,
          whether that website works on a phone, and what it cannot do yet —
          then tagged with the reason it needs you.
        </p>
      </header>

      <AutopilotPanel
        presets={presets}
        autopilotOn={settings.automation.autopilot}
      />

      <DiscoveryConsole
        initialCenter={initialCenter}
        tileUrlTemplate={settings.map.tileUrl}
        tileAttribution={settings.map.tileAttribution}
      />

      {recentSearches.length > 0 && (
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Recent runs</h2>
          <ul className="divide-border mt-3 divide-y text-sm">
            {recentSearches.map((search) => (
              <li
                key={search.searchId}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{search.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {search.categories.length} type
                    {search.categories.length === 1 ? "" : "s"} ·{" "}
                    {(search.radiusMeters / 1000).toFixed(1)} km ·{" "}
                    {search.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {search.status === "completed"
                      ? `${search.added} added`
                      : search.status === "failed"
                        ? "Failed"
                        : "In progress"}
                  </span>
                  <Link
                    href={`/admin/customers?searchId=${search.searchId}`}
                    className="text-primary text-xs underline-offset-2 hover:underline"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Business data comes from OpenStreetMap ({OSM_ATTRIBUTION}), used under
        the Open Database Licence. Websites are checked passively — one public
        page request, no scanning, no logins.{" "}
        <Link
          href="/admin/settings"
          className="text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline"
        >
          Automation settings
          <ExternalLink className="size-3" />
        </Link>
      </p>
    </div>
  );
}
