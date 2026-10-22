import type { Metadata } from "next";
import { requireCapability, assertCapability } from "@/lib/server/auth/dal";
import {
  JOB_TYPES,
  retryJob,
  cancelJob,
  getQueueStats,
} from "@/lib/server/jobs/queue";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/server/audit-log";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jobs } from "@/lib/server/db/collections";

export const metadata: Metadata = { title: "Job Queue" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

async function retryJobAction(formData: FormData): Promise<void> {
  "use server";
  const session = await assertCapability("manage_jobs");

  const schema = z.object({ jobId: z.string().length(24) });
  const parsed = schema.safeParse({ jobId: formData.get("jobId") });
  if (!parsed.success) return;

  const { jobId } = parsed.data;

  try {
    const ok = await retryJob(jobId);
    if (!ok) return;

    await recordAudit({
      action: AUDIT_ACTIONS.jobRetried,
      actorId: session.userId,
      target: { type: "job", id: jobId },
    });
    revalidatePath("/admin/jobs");
  } catch (error) {
    console.error("retryJobAction error:", error);
  }
}

async function cancelJobAction(formData: FormData): Promise<void> {
  "use server";
  const session = await assertCapability("manage_jobs");

  const schema = z.object({ jobId: z.string().length(24) });
  const parsed = schema.safeParse({ jobId: formData.get("jobId") });
  if (!parsed.success) return;

  const { jobId } = parsed.data;

  try {
    const ok = await cancelJob(jobId);
    if (!ok) return;

    await recordAudit({
      action: AUDIT_ACTIONS.jobCancelled,
      actorId: session.userId,
      target: { type: "job", id: jobId },
    });
    revalidatePath("/admin/jobs");
  } catch (error) {
    console.error("cancelJobAction error:", error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  [JOB_TYPES.prospectDiscover]: "Prospect discover",
  [JOB_TYPES.prospectEnrich]: "Prospect enrich",
  [JOB_TYPES.emailSend]: "Email send",
  [JOB_TYPES.sequenceTick]: "Sequence tick",
  [JOB_TYPES.autopilotTick]: "Autopilot tick",
  [JOB_TYPES.blogPublishScheduled]: "Blog publish",
  [JOB_TYPES.blogGenerate]: "Blog generate",
  [JOB_TYPES.searchPing]: "Search ping",
  [JOB_TYPES.dailyDigest]: "Daily digest",
  [JOB_TYPES.replyPoll]: "Reply poll",
  [JOB_TYPES.analyticsRollup]: "Analytics roll-up",
  [JOB_TYPES.chatSummaries]: "Chat summaries",
  [JOB_TYPES.churnScan]: "Churn scan",
  [JOB_TYPES.leadScore]: "Lead scoring",
  [JOB_TYPES.prospectResearch]: "Prospect research",
  [JOB_TYPES.outreachDraft]: "Outreach drafts",
  [JOB_TYPES.lifecycleTick]: "Lifecycle tick",
  [JOB_TYPES.proposalFollowups]: "Proposal follow-ups",
  [JOB_TYPES.bookingReminders]: "Booking reminders",
  [JOB_TYPES.reportWeekly]: "Weekly report",
  [JOB_TYPES.socialDrafts]: "Social drafts",
  [JOB_TYPES.feedbackRequests]: "Feedback requests",
  [JOB_TYPES.newsletterDraft]: "Newsletter draft",
  [JOB_TYPES.seoSelfAudit]: "SEO self-audit",
  [JOB_TYPES.reportMonthly]: "Monthly reports",
};

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  queued: { badge: "bg-blue-100 text-blue-800", label: "Queued" },
  running: { badge: "bg-amber-100 text-amber-800", label: "Running" },
  completed: { badge: "bg-green-100 text-green-700", label: "Completed" },
  failed: { badge: "bg-red-100 text-red-700", label: "Failed" },
  cancelled: { badge: "bg-gray-100 text-gray-600", label: "Cancelled" },
};

// ---------------------------------------------------------------------------
// Page — reads searchParams for filters
// ---------------------------------------------------------------------------

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminJobsPage({ searchParams }: Props) {
  await requireCapability("manage_jobs");

  const params = await searchParams;
  const statusFilter =
    typeof params.status === "string" ? params.status : "all";
  const typeFilter = typeof params.type === "string" ? params.type : "all";

  // Fetch filtered jobs
  const collection = await jobs();
  const filter: Record<string, unknown> = {};
  if (statusFilter !== "all") filter.status = statusFilter;
  if (typeFilter !== "all") filter.type = typeFilter;

  const [allJobs, stats] = await Promise.all([
    collection.find(filter).sort({ createdAt: -1 }).limit(200).toArray(),
    getQueueStats(),
  ]);

  const jobTypes = Object.values(JOB_TYPES) as string[];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Job Queue</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Background jobs — pending, running, completed, failed, or dead. Retry
          or cancel individual jobs here.
        </p>
      </header>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 rounded-lg border p-4">
        {(
          [
            ["queued", "Queued", "text-blue-700"],
            ["running", "Running", "text-amber-700"],
            ["completed", "Completed", "text-green-700"],
            ["failed", "Failed", "text-red-700"],
            ["cancelled", "Cancelled", "text-gray-600"],
          ] as const
        ).map(([key, label, colour]) => (
          <div key={key} className="min-w-[72px] text-center">
            <div className={`text-2xl font-bold ${colour}`}>
              {stats[key] ?? 0}
            </div>
            <div className="text-muted-foreground text-xs">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters — plain links so they work without JS */}
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Status
          </label>
          <div className="flex flex-wrap gap-1">
            {[
              "all",
              "queued",
              "running",
              "completed",
              "failed",
              "cancelled",
            ].map((s) => (
              <a
                key={s}
                href={`/admin/jobs?status=${s}&type=${typeFilter}`}
                className={`rounded border px-2 py-1 text-xs capitalize ${
                  statusFilter === s
                    ? "border-foreground bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                {s}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Type
          </label>
          <div className="flex flex-wrap gap-1">
            <a
              href={`/admin/jobs?status=${statusFilter}&type=all`}
              className={`rounded border px-2 py-1 text-xs ${
                typeFilter === "all"
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              All
            </a>
            {jobTypes.map((t) => (
              <a
                key={t}
                href={`/admin/jobs?status=${statusFilter}&type=${t}`}
                className={`rounded border px-2 py-1 text-xs ${
                  typeFilter === t
                    ? "border-foreground bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                {TYPE_LABELS[t] ?? t}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Result / Error</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allJobs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  No jobs match the current filter.
                </td>
              </tr>
            ) : (
              allJobs.map((job) => {
                const jobId = job._id?.toHexString() ?? "";
                const typeLabel = TYPE_LABELS[job.type] ?? job.type;
                const style =
                  STATUS_STYLES[job.status] ?? STATUS_STYLES["queued"];

                const resultSnippet = job.result
                  ? JSON.stringify(job.result).slice(0, 120)
                  : null;
                const logLines = Array.isArray(
                  (job.result as Record<string, unknown> | null)?.log,
                )
                  ? (
                      (job.result as Record<string, unknown>).log as string[]
                    ).slice(0, 3)
                  : null;

                return (
                  <tr
                    key={jobId}
                    className="hover:bg-muted/20 border-b last:border-0"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {typeLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {job.createdAt
                        ? new Date(job.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs">
                      {job.lastError ? (
                        <span
                          className="break-words text-red-600"
                          title={job.lastError}
                        >
                          {job.lastError.slice(0, 100)}
                          {job.lastError.length > 100 ? "…" : ""}
                        </span>
                      ) : logLines ? (
                        <ul className="text-muted-foreground space-y-0.5">
                          {logLines.map((line, i) => (
                            <li key={i} className="truncate">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : resultSnippet ? (
                        <span
                          className="text-muted-foreground font-mono"
                          title={JSON.stringify(job.result)}
                        >
                          {resultSnippet}
                          {(resultSnippet.length ?? 0) === 120 ? "…" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {(job.status === "failed" ||
                          job.status === "cancelled") && (
                          <form action={retryJobAction}>
                            <input type="hidden" name="jobId" value={jobId} />
                            <button
                              type="submit"
                              className="rounded border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2"
                            >
                              Retry
                            </button>
                          </form>
                        )}
                        {(job.status === "queued" ||
                          job.status === "running") && (
                          <form action={cancelJobAction}>
                            <input type="hidden" name="jobId" value={jobId} />
                            <button
                              type="submit"
                              className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {allJobs.length === 200 && (
        <p className="text-muted-foreground text-center text-xs">
          Showing the 200 most recent matching jobs. Use type/status filters to
          narrow the list.
        </p>
      )}
    </div>
  );
}
