"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AuditEmailForm } from "@/components/audit/audit-email-form";
import { AuditSummary } from "@/components/audit/audit-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFallbackAuditSummary } from "@/lib/audit-summary";
import { toAuditEmailFindings } from "@/lib/audit-email";
import {
  categoryLabel,
  type AuditCategory,
  type AuditFinding,
  type WebsiteAuditResponse,
  type WebsiteAuditResult,
} from "@/lib/website-audit";
import { cn } from "@/lib/utils";

const categories: AuditCategory[] = [
  "seo",
  "performance",
  "accessibility",
  "security",
];

export function WebsiteAuditTool() {
  const [url, setUrl] = React.useState("");
  const [result, setResult] = React.useState<WebsiteAuditResult>();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setResult(undefined);
    setPending(true);

    try {
      const response = await fetch("/api/website-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as WebsiteAuditResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "The audit failed." : payload.message);
      }
      setResult(payload.result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The audit could not be completed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={submit}
        className="bg-background mx-auto max-w-3xl rounded-[28px] p-6 sm:p-8"
      >
        <Label htmlFor="audit-url">Website URL</Label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            id="audit-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com"
            required
            maxLength={500}
            aria-describedby="audit-scope audit-error"
            className="h-12"
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="shrink-0"
            data-track="website-audit-submit"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Auditing…
              </>
            ) : (
              <>
                <Search className="size-4" />
                Audit website
              </>
            )}
          </Button>
        </div>
        <p
          id="audit-scope"
          className="text-muted-foreground mt-3 text-[13px] leading-[1.55]"
        >
          Passive public check only. No login, JavaScript execution, port scan,
          exploit attempt, endpoint discovery, or authenticated testing.
        </p>
        {error ? (
          <p
            id="audit-error"
            role="alert"
            className="bg-destructive/10 text-destructive mt-4 rounded-[14px] px-4 py-3 text-[14px]"
          >
            {error}
          </p>
        ) : null}
      </form>

      {result ? <AuditResults result={result} /> : null}
    </div>
  );
}

function AuditResults({ result }: { result: WebsiteAuditResult }) {
  const summary = `Website audit for ${result.finalUrl}: score ${result.overallScore}/100. Priority findings: ${result.findings
    .filter((finding) => finding.status !== "pass")
    .slice(0, 4)
    .map((finding) => finding.title)
    .join(", ")}.`;
  const contactHref = `/contact?estimate=${encodeURIComponent(`${summary} I would like Bitecodes to review and fix these issues.`)}`;
  const summaryInput = {
    url: result.finalUrl,
    score: result.overallScore,
    context: "audit" as const,
    findings: result.findings.map((finding) => ({
      status: finding.status,
      title: finding.title,
      detail: finding.detail,
      recommendation: finding.recommendation,
    })),
  };
  const fallbackSummary = buildFallbackAuditSummary(summaryInput);

  return (
    <section className="mt-10" aria-labelledby="audit-results-heading">
      <div className="bg-foreground text-background rounded-[28px] p-7 sm:p-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-background/60 text-[11px] font-semibold tracking-[0.14em] uppercase">
              Passive audit result
            </p>
            <h2
              id="audit-results-heading"
              className="mt-2 text-3xl font-semibold tracking-[-0.025em] tabular-nums"
            >
              {result.overallScore}
              <span className="text-background/50 text-lg">/100</span>
            </h2>
            <p className="text-background/65 mt-2 max-w-xl truncate text-[14px]">
              {result.finalUrl}
            </p>
          </div>
          <Button asChild>
            <Link href={contactHref} data-track="website-audit-quote-click">
              Get a remediation quote
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <ScoreCard
              key={category}
              category={category}
              score={result.scores[category]}
            />
          ))}
        </div>
        <p className="text-background/55 mt-6 text-[13px] leading-[1.55]">
          {result.scope}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {categories.map((category) => (
          <article
            key={category}
            className="bg-background rounded-[24px] p-6 sm:p-7"
          >
            <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
              {categoryLabel(category)}
            </h3>
            <div className="mt-5 space-y-5">
              {result.findings
                .filter((finding) => finding.category === category)
                .map((finding) => (
                  <Finding key={finding.title} finding={finding} />
                ))}
            </div>
          </article>
        ))}
      </div>

      <AuditSummary input={summaryInput} />

      <AuditEmailForm
        source="website-audit"
        url={result.finalUrl}
        score={result.overallScore}
        summary={fallbackSummary}
        findings={toAuditEmailFindings(result.findings)}
      />

      <div className="bg-background mt-6 rounded-[24px] p-6 sm:p-7">
        <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
          Book a free 30-minute review call
        </h3>
        <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
          Walk through the findings with a developer, decide what matters first,
          and leave with a clear next step. No obligation and no sales script.
        </p>
        <Button asChild className="mt-4">
          <Link href="/book-a-call" data-track="website-audit-book-call">
            Book a free review call
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ScoreCard({
  category,
  score,
}: {
  category: AuditCategory;
  score: number;
}) {
  return (
    <div className="bg-background/10 rounded-[18px] p-4">
      <p className="text-background/55 text-[13px]">
        {categoryLabel(category)}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          score >= 80
            ? "text-emerald-300"
            : score >= 60
              ? "text-amber-300"
              : "text-red-300",
        )}
      >
        {score}
      </p>
    </div>
  );
}

function Finding({ finding }: { finding: AuditFinding }) {
  const Icon =
    finding.status === "pass"
      ? CheckCircle2
      : finding.status === "warning"
        ? AlertTriangle
        : XCircle;
  return (
    <div className="flex gap-3">
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          finding.status === "pass"
            ? "text-emerald-600"
            : finding.status === "warning"
              ? "text-amber-600"
              : "text-destructive",
        )}
      />
      <div>
        <p className="text-[15px] font-semibold">{finding.title}</p>
        <p className="text-muted-foreground mt-1 text-[14px] leading-[1.55]">
          {finding.detail}
        </p>
        {finding.status !== "pass" && finding.recommendation ? (
          <p className="mt-2 text-[14px] leading-[1.55]">
            <ShieldCheck className="text-primary mr-1 inline size-4" />
            {finding.recommendation}
          </p>
        ) : null}
      </div>
    </div>
  );
}
