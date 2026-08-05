"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Play, Power, Trash2, Zap } from "lucide-react";
import {
  runAutopilotNowAction,
  setAutopilotPresetEnabledAction,
  deleteAutopilotPresetAction,
} from "@/lib/server/prospecting/actions";
import type { AutopilotPresetSummary } from "@/lib/server/autopilot";
import { Button } from "@/components/ui/button";

/**
 * The hands-off control surface: whether autopilot is on, the standing
 * searches it re-runs, and a one-click "grab clients now".
 *
 * The panel does not toggle autopilot itself — that master switch lives in
 * Settings alongside the send caps and the region guard, because turning it on
 * is a policy decision, not a per-visit one. Here the operator manages the
 * searches and forces an immediate pass.
 */
export function AutopilotPanel({
  presets,
  autopilotOn,
}: {
  presets: AutopilotPresetSummary[];
  autopilotOn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runNow() {
    setMessage(null);
    startTransition(async () => {
      const result = await runAutopilotNowAction();
      setMessage(
        result.ok
          ? "Autopilot pass started. Due searches are re-running and eligible customers are being contacted — watch the pipeline."
          : result.error,
      );
    });
  }

  function toggle(presetId: string, enabled: boolean) {
    startTransition(async () => {
      await setAutopilotPresetEnabledAction(presetId, enabled);
    });
  }

  function remove(presetId: string) {
    startTransition(async () => {
      await deleteAutopilotPresetAction(presetId);
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Zap className="text-primary size-4" />
            Autopilot
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
            {autopilotOn ? (
              <>
                On. Saved searches below re-run on their own cadence, and
                qualified customers are contacted automatically within your
                daily caps. Consent-required regions (UK, EU, Australia, Canada)
                are prepared and held for your one-click release.
              </>
            ) : (
              <>
                Off. Turn it on in{" "}
                <Link
                  href="/admin/settings"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Settings → Automation
                </Link>{" "}
                to let it discover and contact customers without you. You can
                still run a one-off pass now.
              </>
            )}
          </p>
        </div>
        <Button onClick={runNow} disabled={pending} variant="gradient">
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Grab clients now
        </Button>
      </div>

      {message && (
        <p className="border-border bg-muted/40 mt-4 rounded-xl border p-3 text-sm leading-relaxed">
          {message}
        </p>
      )}

      {presets.length > 0 ? (
        <ul className="divide-border mt-4 divide-y text-sm">
          {presets.map((preset) => (
            <li
              key={preset.presetId}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {preset.label}
                  {!preset.enabled && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      (paused)
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {preset.categories.length} type
                  {preset.categories.length === 1 ? "" : "s"} ·{" "}
                  {(preset.radiusMeters / 1000).toFixed(1)} km · every{" "}
                  {preset.cadenceHours}h ·{" "}
                  {preset.lastRunAt
                    ? `last run ${new Date(preset.lastRunAt).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short" },
                      )}`
                    : "not run yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggle(preset.presetId, !preset.enabled)}
                  disabled={pending}
                  aria-label={preset.enabled ? "Pause" : "Resume"}
                >
                  <Power className="size-4" />
                  {preset.enabled ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(preset.presetId)}
                  disabled={pending}
                  aria-label="Delete preset"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          No saved searches yet. Select an area and categories on the map above,
          then use “Save as autopilot search” to have the system re-run it on a
          schedule.
        </p>
      )}
    </section>
  );
}
