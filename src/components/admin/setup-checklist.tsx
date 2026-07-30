import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SetupState } from "@/lib/server/admin/setup";

/**
 * The getting-started panel.
 *
 * Shown only while there is something left to do, and it renders nothing once
 * every step is done — a permanent checklist of ticks is noise on a dashboard
 * someone opens every morning. Steps stay visible after completion while any
 * step remains, so the sequence still reads as a whole.
 */
export function SetupChecklist({ state }: { state: SetupState }) {
  if (state.allDone) return null;

  const next = state.steps.find((step) => !step.done);

  return (
    <section
      aria-labelledby="setup-heading"
      className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="setup-heading" className="font-semibold">
          Getting set up
        </h2>
        <p className="text-muted-foreground text-sm">
          {state.completed} of {state.total} done
        </p>
      </div>

      <ol className="mt-4 space-y-2">
        {state.steps.map((step, index) => {
          const isNext = step.id === next?.id;
          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                isNext ? "border-primary/40 bg-primary/5" : "border-border",
                step.done && "opacity-60",
              )}
            >
              <div className="flex min-w-0 gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    step.done
                      ? "bg-primary/15 text-primary"
                      : step.blocking
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="size-3.5" />
                  ) : step.blocking ? (
                    <CircleAlert className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {step.title}
                    {step.done ? (
                      <span className="sr-only"> — done</span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>
              </div>

              {step.done ? null : (
                <Button
                  asChild
                  size="sm"
                  variant={isNext ? "default" : "outline"}
                  className="shrink-0"
                >
                  <Link href={step.href}>
                    {step.cta}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
