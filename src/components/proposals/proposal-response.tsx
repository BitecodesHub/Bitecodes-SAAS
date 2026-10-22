"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  acceptProposalAction,
  declineProposalAction,
} from "@/lib/server/proposals/actions";
import { trackConversion } from "@/lib/analytics-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The client-facing decision.
 *
 * Acceptance is a typed signature plus an explicit confirmation. Declining is
 * deliberately softer and asks for a reason, because the reason is the most
 * useful part of a "no". Both actions refresh the page on success so the
 * server-rendered record replaces the form.
 */

interface ProposalResponseProps {
  token: string;
}

export function ProposalResponse({ token }: ProposalResponseProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [signature, setSignature] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptProposalAction(token, {
        name,
        title,
        signature,
        accepted: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The URL token is a credential; report only a stable path.
      trackConversion("proposal_accepted", "/proposal");
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineProposalAction(token, declineReason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      trackConversion("proposal_declined", "/proposal");
      router.refresh();
    });
  }

  return (
    <section
      id="decision"
      className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)] sm:p-8 print:hidden"
    >
      <h2 className="text-xl font-semibold tracking-tight">
        Accept this proposal
      </h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        Type your name as a signature and confirm. We will email you next to
        arrange the start date and the first invoice. Nothing is charged from
        this page.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="accept-name">Your name</Label>
          <Input
            id="accept-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accept-title">Your role or title</Label>
          <Input
            id="accept-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Founder, Director, Product lead"
          />
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="accept-signature">Typed signature</Label>
        <Input
          id="accept-signature"
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          placeholder="Type your full name"
          className="font-mono"
        />
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="border-input accent-primary focus-visible:ring-ring/40 mt-0.5 size-4 rounded border"
        />
        <span>
          I confirm that I am authorised to accept this proposal on behalf of
          the client named above, and that the scope, pricing, assumptions, and
          exclusions are agreed.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="mt-5 w-full sm:w-auto"
        onClick={accept}
        disabled={
          pending ||
          !confirmed ||
          name.trim().length < 2 ||
          title.trim().length < 2 ||
          signature.trim().length < 2
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Accept proposal
      </Button>

      <details className="border-border mt-8 border-t pt-6">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors">
          This is not a fit. Tell us why.
        </summary>
        <div className="mt-4 max-w-xl space-y-3">
          <Textarea
            aria-label="Reason for declining"
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            placeholder="Budget timing, scope mismatch, another supplier, or anything else that helps us improve."
            className="min-h-24"
          />
          <Button
            type="button"
            variant="outline"
            onClick={decline}
            disabled={pending || declineReason.trim().length < 3}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Decline proposal
          </Button>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Declining closes this proposal. Nothing is charged, and you can
            still ask for a revised proposal afterwards.
          </p>
        </div>
      </details>
    </section>
  );
}
