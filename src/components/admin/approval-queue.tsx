"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import {
  approveMessagesAction,
  cancelMessagesAction,
} from "@/lib/server/email/actions";
import type { EmailMessageSummary } from "@/lib/server/email/inbox";

/**
 * The approval gate.
 *
 * This is the last point at which a human sees an outreach email before a
 * stranger does, so it shows the full recipient and subject rather than a
 * truncated summary — an operator approving in bulk should be able to spot a
 * wrong address or a template that rendered oddly.
 *
 * Approve and Discard are visually different weights on purpose: approving sends
 * mail that cannot be recalled.
 */

interface ApprovalQueueProps {
  messages: EmailMessageSummary[];
}

export function ApprovalQueue({ messages }: ApprovalQueueProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = messages.length > 0 && selected.size === messages.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      current.size === messages.length
        ? new Set()
        : new Set(messages.map((message) => message.messageId)),
    );
  }, [messages]);

  const toggleOne = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const act = useCallback(
    (mode: "approve" | "cancel") => {
      const ids = [...selected];
      if (ids.length === 0) return;

      startTransition(async () => {
        const result =
          mode === "approve"
            ? await approveMessagesAction(ids)
            : await cancelMessagesAction(ids);

        if (!result.ok) {
          toast({
            title:
              mode === "approve" ? "Could not approve" : "Could not discard",
            description: result.error,
            variant: "error",
          });
          return;
        }

        const count =
          "approved" in result.data
            ? result.data.approved
            : result.data.cancelled;

        toast({
          title:
            mode === "approve"
              ? `${count} approved and sending`
              : `${count} discarded`,
          description:
            mode === "approve"
              ? "These are on their way and cannot be recalled."
              : "Nothing was sent.",
          variant: "success",
        });

        setSelected(new Set());
        router.refresh();
      });
    },
    [selected, router, toast],
  );

  if (messages.length === 0) {
    return (
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Approval queue</h2>
        <p className="text-muted-foreground mt-2 flex items-start gap-2 text-sm leading-relaxed">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Nothing waiting. Outreach you queue from the customers table appears
            here first, so nothing reaches a stranger without you seeing it.
          </span>
        </p>
      </section>
    );
  }

  return (
    <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            Approval queue
            <Badge variant="default" className="ml-2">
              {messages.length}
            </Badge>
          </h2>
          <p className="text-muted-foreground text-sm">
            Read these before approving. Sent email cannot be recalled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || selected.size === 0}
            onClick={() => act("approve")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Approve {selected.size > 0 ? selected.size : ""}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || selected.size === 0}
            onClick={() => act("cancel")}
          >
            <X className="size-4" />
            Discard
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleAll}
          label={
            selected.size === 0
              ? "Select all"
              : `${selected.size} of ${messages.length} selected`
          }
        />
      </div>

      <ul className="divide-border border-border divide-y rounded-xl border">
        {messages.map((message) => (
          <li key={message.messageId} className="flex gap-3 p-3">
            <Checkbox
              checked={selected.has(message.messageId)}
              onChange={() => toggleOne(message.messageId)}
              aria-label={`Select email to ${message.to}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{message.subject}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                To {message.toName ? `${message.toName} · ` : ""}
                {message.to}
                {message.templateKey ? ` · ${message.templateKey}` : ""}
              </p>
            </div>
            <time
              dateTime={message.sendAfter.toISOString()}
              className="text-muted-foreground shrink-0 text-xs"
            >
              {message.sendAfter.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
