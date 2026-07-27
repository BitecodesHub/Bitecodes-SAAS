"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, Mail, StickyNote } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadKind,
  type LeadQuery,
  type LeadSummary,
} from "@/lib/leads/display";
import {
  exportLeadsAction,
  setLeadStatusAction,
} from "@/lib/server/leads/actions";
import type { LeadStatus } from "@/lib/server/db/types";
import { cn } from "@/lib/utils";

/**
 * The leads inbox table.
 *
 * One list across three sources, so bulk actions have to be scoped by source:
 * status lives in a different collection per kind. Rather than hide that, the
 * bulk bar simply refuses a mixed selection and says why — a silent partial
 * update would be worse than a clear refusal.
 */

interface LeadTableProps {
  rows: LeadSummary[];
  /** Echoed back to the export action so the file matches the current view. */
  query: LeadQuery;
  canManage: boolean;
  canEmail: boolean;
}

const STATUS_TONE: Record<
  LeadStatus,
  "default" | "secondary" | "outline" | "muted"
> = {
  new: "default",
  qualified: "default",
  proposal: "secondary",
  won: "secondary",
  lost: "muted",
  spam: "muted",
};

export function LeadTable({
  rows,
  query,
  canManage,
  canEmail,
}: LeadTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      current.size === rows.length
        ? new Set()
        : new Set(rows.map((row) => row.id)),
    );
  }, [rows]);

  const toggleOne = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /**
   * The kinds represented in the current selection.
   *
   * A bulk status change writes to one collection, so a selection spanning two
   * sources cannot be satisfied in one call.
   */
  const selectedKinds = useMemo(() => {
    const kinds = new Set<LeadKind>();
    for (const row of rows) if (selected.has(row.id)) kinds.add(row.kind);
    return [...kinds];
  }, [rows, selected]);

  const runBulkStatus = useCallback(
    (status: string) => {
      if (!status || selected.size === 0) return;

      if (selectedKinds.length > 1) {
        toast({
          title: "Select one source at a time",
          description:
            "Contact form, AI consultant, and website audit leads are stored separately, so a mixed selection cannot be updated in one go.",
          variant: "warning",
        });
        return;
      }

      const kind = selectedKinds[0];
      if (!kind) return;
      const ids = rows
        .filter((row) => selected.has(row.id) && row.kind === kind)
        .map((row) => row.id);

      startTransition(async () => {
        const result = await setLeadStatusAction(kind, ids, status);
        if (!result.ok) {
          toast({
            title: "Could not update",
            description: result.error,
            variant: "error",
          });
          return;
        }
        toast({
          title: `${result.data.changed} lead${result.data.changed === 1 ? "" : "s"} moved`,
          description: `Now marked "${LEAD_STATUS_LABELS[status as LeadStatus]}".`,
          variant: "success",
        });
        setSelected(new Set());
        router.refresh();
      });
    },
    [rows, selected, selectedKinds, router, toast],
  );

  const runExport = useCallback(() => {
    startTransition(async () => {
      const result = await exportLeadsAction(query);
      if (!result.ok) {
        toast({
          title: "Could not export",
          description: result.error,
          variant: "error",
        });
        return;
      }

      // A Server Action cannot stream a download, so the CSV comes back as text
      // and is turned into a file here.
      const blob = new Blob([result.data.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: `Exported ${result.data.rows} lead${result.data.rows === 1 ? "" : "s"}`,
        description: result.data.filename,
        variant: "success",
      });
    });
  }, [query, toast]);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-border bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
        )}
      >
        <span className="text-sm font-medium" aria-live="polite">
          {selected.size === 0
            ? "Select leads to act on them"
            : `${selected.size} selected${
                selectedKinds.length > 1
                  ? ` across ${selectedKinds.length} sources`
                  : ""
              }`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canManage && (
            <Select
              aria-label="Move selected to stage"
              defaultValue=""
              disabled={pending || selected.size === 0}
              onChange={(event) => {
                runBulkStatus(event.target.value);
                event.currentTarget.value = "";
              }}
            >
              <option value="">Move to stage…</option>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={runExport}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="border-border overflow-hidden rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  aria-label="Select all leads on this page"
                />
              </TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What they want</TableHead>
              <TableHead className="w-32">Source</TableHead>
              <TableHead className="w-28">Stage</TableHead>
              <TableHead className="w-32">Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={6}>
                No leads match these filters yet. Enquiries, AI consultant
                briefs, and website audit runs all appear here.
              </TableEmpty>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.name ?? row.reference}`}
                    />
                  </TableCell>

                  <TableCell>
                    <Link
                      href={`/admin/leads/${row.kind}/${row.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.name ?? row.email ?? row.reference}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                      {row.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" />
                          {row.email}
                        </span>
                      )}
                      {row.company && <span>{row.company}</span>}
                      {row.noteCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <StickyNote className="size-3" />
                          {row.noteCount}
                        </span>
                      )}
                    </p>
                  </TableCell>

                  <TableCell>
                    <p className="text-muted-foreground line-clamp-2 max-w-sm text-sm">
                      {row.summary || "—"}
                    </p>
                    {(row.budget || typeof row.score === "number") && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {row.budget}
                        {row.budget && typeof row.score === "number"
                          ? " · "
                          : ""}
                        {typeof row.score === "number"
                          ? `audit score ${row.score}`
                          : ""}
                      </p>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline">
                      {LEAD_KIND_LABELS[row.kind]}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant={STATUS_TONE[row.status]}>
                      {LEAD_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <time
                      dateTime={row.createdAt.toISOString()}
                      className="text-muted-foreground text-xs"
                    >
                      {row.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!canEmail && (
        <p className="text-muted-foreground text-xs">
          Your role cannot send email, so replying is unavailable.
        </p>
      )}
    </div>
  );
}
