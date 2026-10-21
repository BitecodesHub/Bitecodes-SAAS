"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Send, XCircle } from "lucide-react";
import {
  markProposalLostAction,
  sendProposalAction,
} from "@/lib/server/proposals/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalStatus } from "@/lib/server/db/types";

/**
 * The send, copy, preview, and mark-lost controls on the proposal record.
 *
 * The public link is passed in from the server rather than built here, because
 * the token is derived with a server-only secret.
 */

interface ProposalAdminActionsProps {
  proposalId: string;
  status: ProposalStatus;
  publicPath: string;
  /** `send_email` is intentionally separate from `manage_leads`. */
  canSendEmail: boolean;
}

export function ProposalAdminActions({
  proposalId,
  status,
  publicPath,
  canSendEmail,
}: ProposalAdminActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");

  const canSend = status === "draft" && canSendEmail;
  const canCopy = status !== "draft";
  const canLose =
    status === "draft" || status === "sent" || status === "viewed";

  function copyLink() {
    const url = `${window.location.origin}${publicPath}`;
    navigator.clipboard
      .writeText(url)
      .then(() =>
        toast({
          title: "Link copied",
          description: "The private link is ready to paste.",
          variant: "success",
        }),
      )
      .catch(() =>
        toast({
          title: "Could not copy",
          description: url,
          variant: "error",
        }),
      );
  }

  function send() {
    startTransition(async () => {
      const result = await sendProposalAction(proposalId);
      if (!result.ok) {
        toast({
          title: "Not sent",
          description: result.error,
          variant: "error",
        });
        return;
      }
      toast({
        title: "Proposal sent",
        description: "The client received the private review link.",
        variant: "success",
      });
      router.refresh();
    });
  }

  function markLost() {
    startTransition(async () => {
      const result = await markProposalLostAction(proposalId, lostReason);
      if (!result.ok) {
        toast({
          title: "Not saved",
          description: result.error,
          variant: "error",
        });
        return;
      }
      setLostOpen(false);
      setLostReason("");
      toast({ title: "Proposal marked lost", variant: "success" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canSend && (
          <Button type="button" onClick={send} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send to client
          </Button>
        )}
        {canCopy && (
          <Button type="button" variant="outline" onClick={copyLink}>
            <Copy className="size-4" />
            Copy link
          </Button>
        )}
        <Button asChild variant="outline">
          <Link
            href={`/admin/proposals/${proposalId}/preview`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4" />
            Preview
          </Link>
        </Button>
        {canLose && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLostOpen((open) => !open)}
          >
            <XCircle className="size-4" />
            Mark lost
          </Button>
        )}
      </div>

      {canSend && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Sending emails the client and marks the proposal as sent. The link
          keeps working after the email, until the proposal expires or is
          answered.
        </p>
      )}
      {status === "draft" && !canSendEmail && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          You can prepare this draft. Sending needs the email permission, which
          an owner or admin can grant.
        </p>
      )}

      {lostOpen && canLose && (
        <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-4">
          <label htmlFor="lost-reason" className="text-sm font-medium">
            Why is this proposal lost?
          </label>
          <Textarea
            id="lost-reason"
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value)}
            placeholder="Chose another supplier, budget deferred, went quiet after two follow-ups."
            className="min-h-20"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markLost}
              disabled={pending || lostReason.trim().length < 3}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Confirm lost
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLostOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
