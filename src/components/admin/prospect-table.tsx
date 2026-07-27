"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Repeat,
  Send,
} from "lucide-react";
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
  PROSPECT_PIPELINE,
  PROSPECT_STATUS_LABELS,
  scoreBand,
  shortUrl,
  tagBadgeVariant,
  tagLabel,
} from "@/lib/prospecting/display";
import {
  enrichProspectsAction,
  setProspectStatusAction,
} from "@/lib/server/prospecting/actions";
import {
  enrollProspectsAction,
  sendOutreachAction,
} from "@/lib/server/email/actions";
import type { ProspectStatus, ProspectTag } from "@/lib/server/db/types";
import { cn } from "@/lib/utils";

/**
 * The customers table.
 *
 * Selection and bulk actions live on the client; filtering and pagination are
 * URL state handled by the server page. Keeping filters in the URL means a
 * filtered view is shareable and survives a reload — an operator who has
 * narrowed to "no website, Ahmedabad, hot" should be able to send that link to
 * someone else.
 */

export interface ProspectRow {
  id: string;
  name: string;
  categoryLabel: string | null;
  city: string | null;
  website: string | null;
  socialUrl: string | null;
  email: string | null;
  phone: string | null;
  status: ProspectStatus;
  primaryTag: ProspectTag | null;
  score: number | null;
  topIssue: string | null;
  contactCount: number;
}

interface ProspectTableProps {
  rows: ProspectRow[];
  /** True when the signed-in user may change records. */
  canManage: boolean;
  /** True when the signed-in user may put email in front of a real person. */
  canEmail: boolean;
}

export function ProspectTable({
  rows,
  canManage,
  canEmail,
}: ProspectTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      current.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
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

  const ids = useMemo(() => [...selected], [selected]);

  const runBulkStatus = useCallback(
    (status: string) => {
      if (!status || ids.length === 0) return;
      startTransition(async () => {
        const result = await setProspectStatusAction(ids, status);
        if (!result.ok) {
          toast({
            title: "Could not update",
            description: result.error,
            variant: "error",
          });
          return;
        }
        toast({
          title: `${result.data.changed} customer${result.data.changed === 1 ? "" : "s"} moved`,
          description: `Now marked "${PROSPECT_STATUS_LABELS[status as ProspectStatus]}".`,
          variant: "success",
        });
        setSelected(new Set());
        router.refresh();
      });
    },
    [ids, router, toast],
  );

  const runRecheck = useCallback(() => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await enrichProspectsAction(ids);
      if (!result.ok) {
        toast({
          title: "Could not re-check",
          description: result.error,
          variant: "error",
        });
        return;
      }
      toast({
        title: `Re-checking ${result.data.queued}`,
        description: "Websites are being audited again in the background.",
        variant: "success",
      });
      setSelected(new Set());
      router.refresh();
    });
  }, [ids, router, toast]);

  /**
   * Queues the tag-matched template for each selected customer.
   *
   * The result is reported in full rather than as a bare success. A run that
   * queues three and skips seven is the normal case — most skips are "no email
   * address" or "not checked yet" — and an operator who is told only "queued 3"
   * has no idea the other seven exist.
   */
  const runOutreach = useCallback(() => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await sendOutreachAction(ids);
      if (!result.ok) {
        toast({
          title: "Could not queue outreach",
          description: result.error,
          variant: "error",
        });
        return;
      }

      const { queued, skipped, requiresApproval } = result.data;
      const skippedNote =
        skipped.length > 0
          ? ` ${skipped.length} skipped — ${summariseSkips(skipped)}.`
          : "";

      toast({
        title:
          queued === 0
            ? "Nothing queued"
            : requiresApproval
              ? `${queued} waiting for your approval`
              : `${queued} queued to send`,
        description:
          (queued > 0 && requiresApproval
            ? "Review them under Email → Approval queue before they leave."
            : queued > 0
              ? "Approval is switched off, so these will send shortly."
              : "") + skippedNote,
        variant: queued === 0 && skipped.length > 0 ? "warning" : "success",
      });

      setSelected(new Set());
      router.refresh();
    });
  }, [ids, router, toast]);

  /**
   * Enrols the selection in the follow-up sequence.
   *
   * Separate from "Send email", which sends exactly one. Enrolling commits to up
   * to three messages over a fortnight, so it is a deliberate second choice
   * rather than an option buried in the same button.
   */
  const runEnroll = useCallback(() => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await enrollProspectsAction(ids);
      if (!result.ok) {
        toast({
          title: "Could not start the sequence",
          description: result.error,
          variant: "error",
        });
        return;
      }

      const { enrolled, skipped } = result.data;
      toast({
        title:
          enrolled === 0
            ? "Nobody enrolled"
            : `${enrolled} started on the follow-up sequence`,
        description:
          (enrolled > 0
            ? "First email now, then two follow-ups over a fortnight. It stops itself if they click, unsubscribe, or you move them along."
            : "") +
          (skipped.length > 0
            ? ` ${skipped.length} skipped — ${summariseSkips(skipped)}.`
            : ""),
        variant: enrolled === 0 && skipped.length > 0 ? "warning" : "success",
      });

      setSelected(new Set());
      router.refresh();
    });
  }, [ids, router, toast]);

  return (
    <div className="space-y-3">
      {canManage && (
        <div
          className={cn(
            "border-border bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-opacity",
            selected.size === 0 && "pointer-events-none opacity-50",
          )}
        >
          <span className="text-sm font-medium" aria-live="polite">
            {selected.size === 0
              ? "Select customers to act on them"
              : `${selected.size} selected`}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
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
              {PROSPECT_PIPELINE.map((status) => (
                <option key={status} value={status}>
                  {PROSPECT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>

            {canEmail && (
              <Button
                type="button"
                size="sm"
                disabled={pending || selected.size === 0}
                onClick={runOutreach}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send email
              </Button>
            )}

            {canEmail && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || selected.size === 0}
                onClick={runEnroll}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Repeat className="size-4" />
                )}
                Start sequence
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || selected.size === 0}
              onClick={runRecheck}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Re-check websites
            </Button>
          </div>
        </div>
      )}

      <div className="border-border overflow-hidden rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    aria-label="Select all customers on this page"
                  />
                </TableHead>
              )}
              <TableHead>Business</TableHead>
              <TableHead>Why they need you</TableHead>
              <TableHead className="w-24">Score</TableHead>
              <TableHead className="w-32">Stage</TableHead>
              <TableHead className="w-40">Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={canManage ? 6 : 5}>
                No customers match these filters yet. Try{" "}
                <Link
                  href="/admin/customers/discover"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  grabbing new customers
                </Link>
                .
              </TableEmpty>
            ) : (
              rows.map((row) => {
                const band = scoreBand(row.score);
                return (
                  <TableRow key={row.id}>
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </TableCell>
                    )}

                    <TableCell>
                      <Link
                        href={`/admin/customers/${row.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {row.categoryLabel && <span>{row.categoryLabel}</span>}
                        {row.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" />
                            {row.city}
                          </span>
                        )}
                        {row.website ? (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="size-3" />
                            {shortUrl(row.website)}
                          </span>
                        ) : row.socialUrl ? (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="size-3" />
                            social only
                          </span>
                        ) : null}
                      </p>
                    </TableCell>

                    <TableCell>
                      <Badge variant={tagBadgeVariant(row.primaryTag)}>
                        {tagLabel(row.primaryTag)}
                      </Badge>
                      {row.topIssue && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 max-w-sm text-xs">
                          {row.topIssue}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        className="text-sm font-medium"
                        style={{ color: SCORE_COLORS[band.tone] }}
                      >
                        {band.label}
                      </span>
                      {typeof row.score === "number" && (
                        <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                          {row.score}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">
                        {PROSPECT_STATUS_LABELS[row.status]}
                      </span>
                      {row.contactCount > 0 && (
                        <p className="text-muted-foreground text-xs">
                          emailed {row.contactCount}×
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-muted-foreground space-y-0.5 text-xs">
                        {row.email ? (
                          <p className="inline-flex items-center gap-1">
                            <Mail className="size-3 shrink-0" />
                            <span className="truncate">{row.email}</span>
                          </p>
                        ) : (
                          <p className="inline-flex items-center gap-1">
                            <Mail className="size-3 shrink-0 opacity-40" />
                            <span className="opacity-60">no email</span>
                          </p>
                        )}
                        {row.phone && (
                          <p className="inline-flex items-center gap-1">
                            <Phone className="size-3 shrink-0" />
                            {row.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const SCORE_COLORS: Record<string, string> = {
  hot: "var(--chart-critical)",
  warm: "var(--chart-4)",
  cool: "var(--chart-1)",
  cold: "var(--muted-foreground)",
};

/**
 * Condenses per-prospect skip reasons into a readable phrase.
 *
 * Ten rows of "no email address" is noise; "7 have no email address" is
 * information the operator can act on.
 */
function summariseSkips(
  skipped: Array<{ reason: string; detail: string }>,
): string {
  const labels: Record<string, string> = {
    "no-email": "no email address",
    "not-classified": "not checked yet",
    "already-contacted": "already contacted",
    "no-template": "no template for their tag",
    "suppressed-or-capped": "unsubscribed or over the daily cap",
    "already-enrolled": "already in a sequence",
    unsubscribed: "unsubscribed",
    "sequence-disabled": "the sequence is switched off",
    missing: "no longer exists",
  };

  const counts = new Map<string, number>();
  for (const entry of skipped) {
    const label = labels[entry.reason] ?? entry.reason;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${count} ${label}`)
    .join(", ");
}
