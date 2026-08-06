"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, Inbox, Loader2, ShieldAlert } from "lucide-react";
import {
  exportSubmissionsCsvAction,
  setSubmissionStatusAction,
} from "@/lib/server/forms/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SubmissionRow {
  submissionId: string;
  createdAt: string;
  status: "new" | "spam" | "archived";
  data: Record<string, string | number | boolean | string[]>;
}

/**
 * Submissions table with CSV export.
 *
 * Values are rendered as text, never as HTML — submissions are untrusted input
 * from anyone who can reach the embedded form.
 */
export function FormSubmissions({
  formId,
  columns,
  submissions,
}: {
  formId: string;
  columns: string[];
  submissions: SubmissionRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function mark(submissionId: string, status: "spam" | "archived") {
    start(async () => {
      const result = await setSubmissionStatusAction(
        formId,
        submissionId,
        status,
      );
      if (result.ok) router.refresh();
      else
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
    });
  }

  function exportCsv() {
    start(async () => {
      const result = await exportSubmissionsCsvAction(formId);
      if (!result.ok) {
        toast({
          title: "Could not export",
          description: result.error,
          variant: "error",
        });
        return;
      }
      const blob = new Blob([result.data.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {submissions.length} most recent submission
          {submissions.length === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={pending || submissions.length === 0}
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export CSV
        </Button>
      </div>

      {submissions.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border p-10 text-center text-sm shadow-[var(--shadow-soft)]">
          <Inbox className="size-6" />
          <p>
            No submissions yet. Once the form is embedded, they appear here.
          </p>
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-2xl border shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="p-3 font-medium">When</th>
                {columns.map((c) => (
                  <th key={c} className="p-3 font-medium">
                    {c}
                  </th>
                ))}
                <th className="p-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {submissions.map((s) => (
                <tr key={s.submissionId}>
                  <td className="text-muted-foreground p-3 text-xs whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  {columns.map((c) => (
                    <td key={c} className="max-w-[280px] p-3 align-top">
                      <span className="line-clamp-3 break-words">
                        {String(s.data[c] ?? "")}
                      </span>
                    </td>
                  ))}
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <Badge
                        variant={s.status === "new" ? "secondary" : "muted"}
                      >
                        {s.status}
                      </Badge>
                      {s.status === "new" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => mark(s.submissionId, "archived")}
                            disabled={pending}
                            aria-label="Archive"
                          >
                            <Archive className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => mark(s.submissionId, "spam")}
                            disabled={pending}
                            aria-label="Mark as spam"
                          >
                            <ShieldAlert className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
