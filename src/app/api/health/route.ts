import type { NextRequest } from "next/server";
import { getCronSecret } from "@/lib/server/env";
import { safeCompare } from "@/lib/server/crypto";
import { pingDatabase } from "@/lib/server/db/collections";
import { getSettingsFresh } from "@/lib/server/settings";
import { capabilityMatrix, capabilitySummary } from "@/lib/server/capabilities";
import { autonomySnapshot } from "@/lib/server/bootstrap";
import { runHealthChecks, overallHealth } from "@/lib/server/admin/health";

/**
 * Machine-readable health.
 *
 * Two levels, because they serve different audiences:
 *
 * - **Shallow (public, no secrets).** Is the database reachable, what can this
 *   deployment currently do, and what state is the autonomous loop in? This is
 *   the endpoint a deployment check calls after a release, and the one that
 *   proves the no-credential profile: the site is up, and each missing
 *   provider is named rather than hidden.
 * - **Deep (`?deep=1`, bearer `CRON_SECRET`).** Every live provider probe from
 *   the admin panel, including remedies and provider errors. It costs external
 *   requests (SMTP verification, provider status endpoints), so it is not
 *   public.
 *
 * A failing database is the only condition that returns 503 in shallow mode.
 * Missing optional providers are expected states, not outages.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function unauthorized() {
  return Response.json(
    { ok: false, error: "Unauthorized" },
    { status: 401, headers: NO_STORE },
  );
}

function deepAuthorized(
  request: NextRequest,
): "ok" | "unauthorized" | "unconfigured" {
  const secret = getCronSecret();
  if (!secret) return "unconfigured";
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return "unauthorized";
  return safeCompare(provided, secret) ? "ok" : "unauthorized";
}

export async function GET(request: NextRequest) {
  const deep =
    request.nextUrl.searchParams.get("deep") === "1" ||
    request.nextUrl.searchParams.get("deep") === "true";

  if (deep) {
    const auth = deepAuthorized(request);
    if (auth === "unconfigured") {
      return Response.json(
        {
          ok: false,
          error:
            "CRON_SECRET is not configured, so deep health checks are unavailable.",
        },
        { status: 503, headers: NO_STORE },
      );
    }
    if (auth === "unauthorized") return unauthorized();

    const [checks, autonomy, settings] = await Promise.all([
      runHealthChecks(),
      autonomySnapshot(),
      getSettingsFresh(),
    ]);
    const capabilities = capabilityMatrix({ settings });
    const status = overallHealth(checks);

    return Response.json(
      {
        ok: status !== "fail",
        status,
        timestamp: new Date().toISOString(),
        checks,
        autonomy,
        capabilities,
        summary: capabilitySummary(capabilities),
      },
      { status: status === "fail" ? 503 : 200, headers: NO_STORE },
    );
  }

  const [database, autonomy, settings] = await Promise.all([
    pingDatabase(),
    autonomySnapshot(),
    getSettingsFresh(),
  ]);
  const capabilities = capabilityMatrix({ settings });

  return Response.json(
    {
      ok: database.ok,
      status: database.ok ? "ok" : "fail",
      timestamp: new Date().toISOString(),
      database: { ok: database.ok, latencyMs: database.latencyMs },
      autonomy: autonomy
        ? {
            bootstrapVersion: autonomy.bootstrap.version,
            lastReconciledAt: autonomy.bootstrap.lastReconciledAt,
            stale: autonomy.bootstrap.stale,
            presets: {
              total: autonomy.presets.total,
              enabled: autonomy.presets.enabled,
              due: autonomy.presets.due,
              nextDueAt: autonomy.presets.nextDueAt,
            },
            scheduleOk: autonomy.schedules.ok,
            outboundGate: autonomy.outboundGate.state,
            queue: autonomy.queue,
            heartbeat: autonomy.heartbeat,
            lastAutopilotRun: autonomy.lastAutopilotRun,
          }
        : null,
      // Detail names the variable or setting to change, never a value.
      capabilities: capabilities.map(({ id, label, state, detail }) => ({
        id,
        label,
        state,
        detail,
      })),
      summary: capabilitySummary(capabilities),
    },
    { status: database.ok ? 200 : 503, headers: NO_STORE },
  );
}
