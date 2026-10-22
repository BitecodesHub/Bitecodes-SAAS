import type { NextRequest } from "next/server";
import { getCronSecret } from "@/lib/server/env";
import { safeCompare } from "@/lib/server/crypto";
import { runBootstrap } from "@/lib/server/bootstrap";

/**
 * Machine-readable first-boot reconciliation.
 *
 * Authenticated with `CRON_SECRET` like the job runner, because it writes
 * records. Body is optional:
 *
 *   { "dryRun": true }   inspect and report, write nothing
 *   { "force": true }    reconcile even if the last run was under 24h ago
 *
 * A dry run always returns 200 when the database is reachable, so a deployment
 * pipeline can ask "what would first boot do?" before letting it do it. A live
 * run that could not complete returns 503 with the same report, including the
 * per-area errors.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function authorized(
  request: NextRequest,
): "ok" | "unauthorized" | "unconfigured" {
  const secret = getCronSecret();
  if (!secret) return "unconfigured";
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return "unauthorized";
  return safeCompare(provided, secret) ? "ok" : "unauthorized";
}

export async function POST(request: NextRequest) {
  const auth = authorized(request);
  if (auth === "unconfigured") {
    return Response.json(
      {
        ok: false,
        error:
          "CRON_SECRET is not configured. The bootstrap endpoint will not run unauthenticated.",
      },
      { status: 503, headers: NO_STORE },
    );
  }
  if (auth === "unauthorized") {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: { dryRun?: unknown; force?: unknown } = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      body = parsed as { dryRun?: unknown; force?: unknown };
    }
  } catch {
    // An empty body is the normal live run; malformed JSON is treated the same
    // way rather than writing anything surprising.
  }

  const report = await runBootstrap({
    dryRun: body.dryRun === true,
    force: body.force === true,
    source: body.dryRun === true ? "api-dry-run" : "api",
  });

  return Response.json(report, {
    status: report.dryRun || report.ok ? 200 : 503,
    headers: NO_STORE,
  });
}
