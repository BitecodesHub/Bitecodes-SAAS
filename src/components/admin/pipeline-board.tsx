"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Columns3, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  LEAD_KIND_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
  type LeadSummary,
} from "@/lib/leads/display";
import { setLeadStageAction } from "@/lib/server/leads/actions";
import { cn } from "@/lib/utils";

/** Link from the list view to the board. */
export function PipelineBoardLink() {
  return (
    <Link
      href="/admin/leads/pipeline"
      className="border-border bg-background hover:bg-muted mt-3 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors"
    >
      <Columns3 className="size-4" />
      Open pipeline board
    </Link>
  );
}

interface PipelineBoardProps {
  /** Fresh rows from the server, one query per column. */
  columns: Record<LeadStage, LeadSummary[]>;
  counts: Record<string, number>;
}

/**
 * Six-column pipeline.
 *
 * Drag and drop is a convenience, not the only path: every card links to its
 * detail page, where the same stage change is available in a labelled select.
 * That keeps the board usable with a keyboard and on touch, where HTML drag
 * events are unreliable.
 */
export function PipelineBoard({ columns, counts }: PipelineBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(columns);
  // Optimistically moved cards while the server action is in flight.
  const [moving, setMoving] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);

  const move = useCallback(
    (row: LeadSummary, to: LeadStage) => {
      if (row.stage === to || row.readOnly || moving) return;

      const from = row.stage;
      const original = items;

      setItems((current) => {
        const next = { ...current };
        next[from] = next[from].filter((entry) => entry.id !== row.id);
        next[to] = [{ ...row, stage: to }, ...next[to]];
        return next;
      });
      setMoving(row.id);

      startTransition(async () => {
        const result = await setLeadStageAction(row.kind, [row.id], to);
        setMoving(null);
        if (!result.ok) {
          setItems(original);
          toast({
            title: "Could not move the lead",
            description: result.error,
            variant: "error",
          });
          return;
        }
        toast({
          title: `Moved to ${LEAD_STAGE_LABELS[to]}`,
          variant: "success",
        });
        router.refresh();
      });
    },
    [items, moving, router, toast],
  );

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Showing up to 100 recent leads per column. Drag a writable card between
        columns, or open it to change the stage with a keyboard.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {LEAD_STAGES.map((stage) => (
            <section
              key={stage}
              aria-label={LEAD_STAGE_LABELS[stage]}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(null);
                const id = event.dataTransfer.getData("text/plain");
                const row = Object.values(items)
                  .flat()
                  .find((entry) => entry.id === id);
                if (row) move(row, stage);
              }}
              className={cn(
                "border-border bg-muted/20 min-h-72 rounded-2xl border p-2.5 transition-colors",
                dragOver === stage && "border-primary bg-primary/5",
              )}
            >
              <header className="flex items-center justify-between px-1 pb-2">
                <h2 className="text-sm font-semibold">
                  {LEAD_STAGE_LABELS[stage]}
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {counts[stage] ?? items[stage].length}
                </span>
              </header>

              <div className="space-y-2">
                {items[stage].length === 0 ? (
                  <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                    Nothing here.
                  </p>
                ) : (
                  items[stage].map((row) => (
                    <article
                      key={row.id}
                      draggable={!row.readOnly}
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", row.id)
                      }
                      className={cn(
                        "border-border bg-card rounded-xl border p-3 shadow-sm transition-shadow",
                        !row.readOnly && "cursor-grab active:cursor-grabbing",
                        moving === row.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/admin/leads/${row.kind}/${row.id}`}
                          className="min-w-0 text-sm font-medium underline-offset-2 hover:underline"
                        >
                          <span className="line-clamp-2">
                            {row.name ?? row.email ?? row.reference}
                          </span>
                        </Link>
                        {typeof row.score === "number" && (
                          <Badge
                            variant={row.grade === "A" ? "default" : "muted"}
                            className="shrink-0 px-1.5 py-0 tabular-nums"
                          >
                            {row.score}
                          </Badge>
                        )}
                      </div>

                      {row.company && (
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {row.company}
                        </p>
                      )}

                      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
                        {row.nextAction || row.summary || "No summary."}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">
                          {LEAD_KIND_LABELS[row.kind]}
                        </span>
                        {row.readOnly && (
                          <span className="text-muted-foreground text-[11px]">
                            · read-only
                          </span>
                        )}
                        {row.grade === "A" && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
                            <Sparkles className="size-3" /> hot
                          </span>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {pending && (
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </p>
      )}
    </div>
  );
}
