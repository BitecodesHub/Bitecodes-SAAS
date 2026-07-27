"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, Plus, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  addSuppressionAction,
  removeSuppressionAction,
} from "@/lib/server/email/actions";

/**
 * The do-not-contact list.
 *
 * Removal is treated as the dangerous operation here, not addition. Adding an
 * address only stops mail; removing one can cause mail to reach someone who
 * previously opted out, so it needs a higher privilege and is confirmed in the
 * UI as well as audited on the server.
 */

interface SuppressionEntry {
  value: string;
  reason: string;
  detail: string | null;
  createdAt: string;
}

interface SuppressionManagerProps {
  entries: SuppressionEntry[];
  total: number;
  /** Only `manage_settings` may undo a suppression. */
  canRemove: boolean;
}

const REASON_LABELS: Record<string, string> = {
  unsubscribed: "Unsubscribed",
  complained: "Marked as spam",
  bounced: "Bounced",
  manual: "Added by hand",
};

export function SuppressionManager({
  entries,
  total,
  canRemove,
}: SuppressionManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = useCallback(() => {
    if (value.trim().length === 0) return;
    startTransition(async () => {
      const result = await addSuppressionAction(value);
      if (!result.ok) {
        toast({
          title: "Could not add",
          description: result.error,
          variant: "error",
        });
        return;
      }
      setValue("");
      toast({
        title: `${result.data.value} will never be emailed`,
        variant: "success",
      });
      router.refresh();
    });
  }, [value, router, toast]);

  const remove = useCallback(
    (entry: string) => {
      startTransition(async () => {
        const result = await removeSuppressionAction(entry);
        setConfirming(null);
        if (!result.ok) {
          toast({
            title: "Could not remove",
            description: result.error,
            variant: "error",
          });
          return;
        }
        toast({
          title: `${entry} removed from the list`,
          description:
            "They can now receive email again. This was recorded in the audit log.",
          variant: "warning",
        });
        router.refresh();
      });
    },
    [router, toast],
  );

  return (
    <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h2 className="text-base font-semibold">
          Never contact
          {total > 0 && (
            <Badge variant="muted" className="ml-2">
              {total}
            </Badge>
          )}
        </h2>
        <p className="text-muted-foreground text-sm">
          Checked before every send. Accepts an address or a whole domain.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="suppress-value">Address or domain</Label>
          <Input
            id="suppress-value"
            value={value}
            placeholder="someone@example.com or example.com"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || value.trim().length === 0}
          onClick={add}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Nobody on the list yet. Unsubscribes land here automatically.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-xl border">
          {entries.map((entry) => (
            <li
              key={entry.value}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {entry.value}
              </span>
              <Badge variant="muted">
                {REASON_LABELS[entry.reason] ?? entry.reason}
              </Badge>
              <time
                dateTime={entry.createdAt}
                className="text-muted-foreground text-xs"
              >
                {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>

              {canRemove &&
                (confirming === entry.value ? (
                  <span className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(entry.value)}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirming(null)}
                    >
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${entry.value} from the never-contact list`}
                    onClick={() => setConfirming(entry.value)}
                  >
                    <Undo2 className="size-4" />
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {total > entries.length && (
        <p className="text-muted-foreground text-xs">
          Showing the {entries.length} most recent of {total}.
        </p>
      )}
    </section>
  );
}
