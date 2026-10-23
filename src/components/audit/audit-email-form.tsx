"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackConversion } from "@/lib/analytics-client";
import { captureAttribution } from "@/lib/attribution";
import {
  AUDIT_FOLLOW_UP_CONSENT_TEXT,
  type AuditEmailFinding,
} from "@/lib/audit-email";

interface AuditEmailFormProps {
  source: "website-audit" | "report";
  url: string;
  score?: number | null;
  summary?: string;
  findings: AuditEmailFinding[];
}

interface EmailResponse {
  ok: boolean;
  message?: string;
  reference?: string;
}

/**
 * "Email me this report" — an optional step after the findings, never a gate
 * in front of them.
 *
 * Follow-up consent is a separate, unticked checkbox. Submitting the form with
 * it unticked stores the lead with contact consent false, so the report is
 * still sent while no nurture sequence may enrol the person later.
 */
export function AuditEmailForm({
  source,
  url,
  score,
  summary,
  findings,
}: AuditEmailFormProps) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [followUp, setFollowUp] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [sentTo, setSentTo] = React.useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    try {
      const response = await fetch("/api/website-audit/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          followUp,
          source,
          url,
          score: score ?? null,
          summary,
          findings: findings.slice(0, 16),
          attribution: captureAttribution(),
        }),
      });
      const result = (await response.json()) as EmailResponse;
      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "The report could not be emailed right now.",
        );
      }
      setSentTo(email);
      // The report page path carries a token, so the event records the page
      // type rather than the live pathname.
      trackConversion(
        "audit_request",
        source === "report" ? "/report" : "/website-audit",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The report could not be emailed right now.",
      );
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <section
        aria-live="polite"
        className="bg-background mt-6 rounded-[24px] p-6 sm:p-7"
        data-track="audit-email-sent"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <h3 className="text-[16px] font-semibold">
              The report is on its way.
            </h3>
            <p className="text-muted-foreground mt-1 text-[15px] leading-[1.55]">
              We sent it to {sentTo}. If it does not arrive within a few
              minutes, check the spam folder or run the audit again.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="audit-email-heading"
      className="bg-background mt-6 rounded-[24px] p-6 sm:p-7"
    >
      <h3
        id="audit-email-heading"
        className="text-[19px] font-semibold tracking-[-0.01em]"
      >
        Email me this report
      </h3>
      <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
        Optional. We will send the findings and the plain-language summary to
        your inbox so you can share them with your team or your developer.
      </p>
      <form
        onSubmit={submit}
        className="mt-5 space-y-4"
        data-track-form="audit-report-email"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`audit-email-${source}`}>Email</Label>
            <Input
              id={`audit-email-${source}`}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <Label htmlFor={`audit-name-${source}`}>Name (optional)</Label>
            <Input
              id={`audit-name-${source}`}
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2"
              placeholder="Your name"
            />
          </div>
        </div>
        <Checkbox
          id={`audit-follow-up-${source}`}
          checked={followUp}
          onChange={(event) => setFollowUp(event.target.checked)}
          label={AUDIT_FOLLOW_UP_CONSENT_TEXT}
        />
        {error ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-[14px] px-4 py-3 text-[14px]"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          data-track="audit-email-submit"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Mail className="size-4" />
              Email me this report
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
