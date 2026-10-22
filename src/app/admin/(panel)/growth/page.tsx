import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCapability, assertCapability } from "@/lib/server/auth/dal";
import { getAutomationAiStatus } from "@/lib/server/ai/automation";
import { RECURRING_AUTOMATIONS } from "@/lib/server/jobs/schedule";
import { enqueueJob } from "@/lib/server/jobs/queue";
import { getSettingsFresh, updateSettings } from "@/lib/server/settings";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/server/audit-log";
import { kickJobs } from "@/lib/server/jobs/worker";
import { z } from "zod";
import { isGrowthToggleKey } from "@/lib/growth/toggles";
import { jobs, aiAutomationRuns } from "@/lib/server/db/collections";
import { BootstrapPanel } from "@/components/admin/bootstrap-panel";

export const metadata: Metadata = { title: "Growth Engine" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

async function toggleAutomation(formData: FormData): Promise<void> {
  "use server";
  const session = await assertCapability("manage_settings");

  const schema = z.object({
    key: z.string(),
    enabled: z.enum(["true", "false"]),
  });

  const parsed = schema.safeParse({
    key: formData.get("key"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return;

  const { key, enabled } = parsed.data;
  if (!isGrowthToggleKey(key)) return;

  const value = enabled === "true";

  try {
    await updateSettings({
      growth: { [key]: value } as Record<string, boolean>,
    });
    await recordAudit({
      action: AUDIT_ACTIONS.growthSettingsUpdated,
      actorId: session.userId,
      target: { type: "growth-toggle", id: key },
      detail: { key, enabled: value },
    });
    revalidatePath("/admin/growth");
  } catch (error) {
    console.error("toggleAutomation error:", error);
  }
}

async function runAutomationNow(formData: FormData): Promise<void> {
  "use server";
  const session = await assertCapability("manage_settings");

  const schema = z.object({ type: z.string().min(1) });
  const parsed = schema.safeParse({ type: formData.get("type") });
  if (!parsed.success) return;

  const { type } = parsed.data;

  try {
    await enqueueJob({
      type: type as import("@/lib/server/jobs/queue").JobType,
      requeueIfFinished: true,
    });
    await recordAudit({
      action: AUDIT_ACTIONS.automationRunNow,
      actorId: session.userId,
      target: { type: "job", id: type },
      detail: { type },
    });
    // Fire-and-forget: kick the worker to pick up the freshly queued job
    kickJobs(30_000).catch(() => undefined);
    revalidatePath("/admin/growth");
  } catch (error) {
    console.error("runAutomationNow error:", error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a cadence object to human-readable UTC + IST strings. */
function formatCadence(
  cadence: (typeof RECURRING_AUTOMATIONS)[number]["cadence"],
): { utc: string; ist: string } {
  function toIst(hourUtc: number): string {
    const totalMinutesUtc = hourUtc * 60;
    const totalMinutesIst = totalMinutesUtc + 5 * 60 + 30;
    const h = Math.floor(totalMinutesIst / 60) % 24;
    const m = totalMinutesIst % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} IST`;
  }

  switch (cadence.kind) {
    case "minute":
      return { utc: "Every minute", ist: "Every minute" };
    case "quarter-hour":
      return { utc: "Every 15 min", ist: "Every 15 min" };
    case "daily": {
      const utcLabel = `Daily ${String(cadence.hourUtc).padStart(2, "0")}:00 UTC`;
      return { utc: utcLabel, ist: `Daily ${toIst(cadence.hourUtc)}` };
    }
    case "weekly": {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayNames = cadence.weekdaysUtc.map((d) => days[d]).join("/");
      const utcLabel = `${dayNames} ${String(cadence.hourUtc).padStart(2, "0")}:00 UTC`;
      return { utc: utcLabel, ist: `${dayNames} ${toIst(cadence.hourUtc)}` };
    }
    case "monthly": {
      const utcLabel = `Day ${cadence.dayOfMonth} ${String(cadence.hourUtc).padStart(2, "0")}:00 UTC`;
      return {
        utc: utcLabel,
        ist: `Day ${cadence.dayOfMonth} ${toIst(cadence.hourUtc)}`,
      };
    }
  }
}

/** Fetches the last 20 AI automation run records for display. */
async function getLast20AiRuns(): Promise<
  Array<{
    purpose: string;
    provider: string;
    model: string;
    ok: boolean;
    durationMs: number | null;
    createdAt: Date | null;
    errorCode: string | null;
  }>
> {
  try {
    const col = await aiAutomationRuns();
    const rows = await col
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .project({
        purpose: 1,
        provider: 1,
        model: 1,
        ok: 1,
        durationMs: 1,
        createdAt: 1,
        errorCode: 1,
      })
      .toArray();
    return rows.map((r) => ({
      purpose: ((r as Record<string, unknown>).purpose as string) ?? "—",
      provider: ((r as Record<string, unknown>).provider as string) ?? "—",
      model: ((r as Record<string, unknown>).model as string) ?? "—",
      ok: Boolean((r as Record<string, unknown>).ok),
      durationMs:
        ((r as Record<string, unknown>).durationMs as number | null) ?? null,
      createdAt:
        ((r as Record<string, unknown>).createdAt as Date | null) ?? null,
      errorCode:
        ((r as Record<string, unknown>).errorCode as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}

/** Query last run status for each automation type. */
async function getLastRunByType(
  types: string[],
): Promise<
  Record<
    string,
    { status: string; finishedAt: Date | null; nextDue: Date | null } | null
  >
> {
  if (types.length === 0) return {};
  try {
    const collection = await jobs();
    const rows = await collection
      .aggregate<{
        _id: string;
        status: string;
        finishedAt: Date | null;
        runAt: Date | null;
      }>([
        {
          $match: {
            type: { $in: types },
            status: { $in: ["completed", "failed", "queued", "running"] },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$type",
            status: { $first: "$status" },
            finishedAt: { $first: "$finishedAt" },
            runAt: { $first: "$runAt" },
          },
        },
      ])
      .toArray();

    const map: Record<
      string,
      { status: string; finishedAt: Date | null; nextDue: Date | null }
    > = {};
    for (const row of rows) {
      map[row._id] = {
        status: row.status,
        finishedAt: row.finishedAt,
        nextDue: row.status === "queued" ? row.runAt : null,
      };
    }
    return map;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminGrowthPage() {
  await requireCapability("view");

  const [aiStatus, settings, lastRuns, last20AiRuns] = await Promise.all([
    getAutomationAiStatus(),
    getSettingsFresh(),
    getLastRunByType(RECURRING_AUTOMATIONS.map((a) => a.type)),
    getLast20AiRuns(),
  ]);

  // Warnings panel
  const warnings: string[] = [];
  if (!process.env.CRON_SECRET) {
    warnings.push(
      "CRON_SECRET is not set — the job runner endpoint will return 403 and no automation will run.",
    );
  }
  if (!process.env.SMTP_HOST) {
    warnings.push(
      "SMTP is not configured — all emails (including the daily digest) will be skipped.",
    );
  }
  if (!settings.contact.address.postal) {
    warnings.push(
      "No postal address set — outreach emails cannot be sent without it (CAN-SPAM).",
    );
  }
  if (!process.env.IMAP_HOST) {
    warnings.push("IMAP not configured — reply detection is disabled.");
  }
  if (!process.env.INDEXNOW_KEY) {
    warnings.push(
      "INDEXNOW_KEY not set — the search engine ping automation is disabled.",
    );
  }
  if (!aiStatus.configured) {
    warnings.push(
      "No AI provider is configured — all AI automations will be skipped.",
    );
  }

  const aiRuns24h = aiStatus.last24h;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Growth Engine
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            AI automation status, recurring job schedule, and control switches.
          </p>
        </div>
        <Link
          href="/admin/desktop"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2"
        >
          Desktop AI settings →
        </Link>
      </header>

      {/* Warnings */}
      {warnings.length > 0 && (
        <section
          className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4"
          aria-label="Configuration warnings"
        >
          <h2 className="text-sm font-semibold text-amber-800">
            Configuration warnings
          </h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <BootstrapPanel />

      {/* AI chain status */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">AI provider chain</h2>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-muted-foreground">Status: </span>
              <span
                className={
                  aiStatus.ready
                    ? "font-medium text-green-700"
                    : "font-medium text-red-600"
                }
              >
                {aiStatus.ready
                  ? "Ready"
                  : !aiStatus.enabled
                    ? "Disabled"
                    : "Not configured"}
              </span>
            </span>
            {aiRuns24h !== null && (
              <>
                <span>
                  <span className="text-muted-foreground">Runs (24 h): </span>
                  <span className="font-medium">{aiRuns24h.runs}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Failures: </span>
                  <span
                    className={
                      aiRuns24h.failures > 0
                        ? "font-medium text-red-600"
                        : "font-medium"
                    }
                  >
                    {aiRuns24h.failures}
                  </span>
                </span>
              </>
            )}
          </div>

          {aiStatus.warnings.length > 0 && (
            <ul className="space-y-0.5 text-sm text-amber-700">
              {aiStatus.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}

          {aiStatus.providers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="pr-6 pb-2 font-medium">Order</th>
                    <th className="pr-6 pb-2 font-medium">Provider</th>
                    <th className="pr-6 pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {aiStatus.providers.map((p, i) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="text-muted-foreground py-2 pr-6">
                        {i + 1}
                      </td>
                      <td className="py-2 pr-6 font-mono text-xs">{p.id}</td>
                      <td className="py-2 pr-6 font-mono text-xs">{p.model}</td>
                      <td className="text-muted-foreground py-2 text-xs capitalize">
                        {p.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No providers configured. Add one under{" "}
              <Link href="/admin/desktop" className="underline">
                Desktop settings
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* Last 20 AI automation runs */}
      {last20AiRuns.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Last 20 AI runs</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {last20AiRuns.map((run, i) => (
                  <tr
                    key={i}
                    className="hover:bg-muted/20 border-b last:border-0"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {run.purpose}
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {run.provider}
                    </td>
                    <td className="text-muted-foreground max-w-[160px] truncate px-4 py-2 font-mono text-xs">
                      {run.model}
                    </td>
                    <td className="px-4 py-2">
                      {run.ok ? (
                        <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          ok
                        </span>
                      ) : (
                        <span
                          className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                          title={run.errorCode ?? undefined}
                        >
                          {run.errorCode ?? "fail"}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {run.durationMs != null ? `${run.durationMs}ms` : "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs whitespace-nowrap">
                      {run.createdAt
                        ? new Date(run.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recurring automations table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Recurring automations</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">Last run</th>
                <th className="px-4 py-3 font-medium">Toggle</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {RECURRING_AUTOMATIONS.map((automation) => {
                const cadence = formatCadence(automation.cadence);
                const lastRun = lastRuns[automation.type];
                const toggleKey = automation.toggle;
                const isEnabled =
                  toggleKey === null
                    ? true
                    : (settings.growth[toggleKey] ?? true);

                return (
                  <tr
                    key={automation.id}
                    className="hover:bg-muted/20 border-b last:border-0"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {automation.label}
                    </td>
                    <td className="text-muted-foreground max-w-xs px-4 py-3">
                      {automation.description}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div>{cadence.utc}</div>
                      <div className="text-muted-foreground">{cadence.ist}</div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {lastRun ? (
                        <div>
                          <span
                            className={
                              lastRun.status === "completed"
                                ? "text-green-700"
                                : lastRun.status === "failed"
                                  ? "text-red-600"
                                  : lastRun.status === "running"
                                    ? "text-amber-600"
                                    : "text-muted-foreground"
                            }
                          >
                            {lastRun.status}
                          </span>
                          {lastRun.finishedAt && (
                            <div className="text-muted-foreground">
                              {new Date(lastRun.finishedAt).toLocaleString(
                                "en-IN",
                                { timeZone: "Asia/Kolkata" },
                              )}
                            </div>
                          )}
                          {lastRun.nextDue && (
                            <div className="text-muted-foreground">
                              Due{" "}
                              {new Date(lastRun.nextDue).toLocaleString(
                                "en-IN",
                                { timeZone: "Asia/Kolkata" },
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {toggleKey !== null ? (
                        <form action={toggleAutomation}>
                          <input type="hidden" name="key" value={toggleKey} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={isEnabled ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            aria-label={`${isEnabled ? "Disable" : "Enable"} ${automation.label}`}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                              isEnabled ? "bg-green-600" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                isEnabled ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </form>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Always on
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={runAutomationNow}>
                        <input
                          type="hidden"
                          name="type"
                          value={automation.type}
                        />
                        <button
                          type="submit"
                          className="hover:bg-muted rounded border px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 disabled:opacity-50"
                        >
                          Run now
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
