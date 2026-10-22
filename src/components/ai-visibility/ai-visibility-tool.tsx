"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AiVisibilityResponse,
  AiVisibilityResult,
  CheckStatus,
} from "@/lib/ai-visibility";
import { cn } from "@/lib/utils";

const gradeCopy: Record<
  AiVisibilityResult["grade"],
  { label: string; line: string }
> = {
  strong: {
    label: "Strong foundation",
    line: "AI crawlers can read the page and the key entities are clearly stated.",
  },
  fair: {
    label: "Useful, with gaps",
    line: "The basics are there, but some signals are missing or ambiguous.",
  },
  weak: {
    label: "Hard for AI to read",
    line: "Several signals an answer engine needs are missing or blocked.",
  },
};

export function AiVisibilityTool() {
  const [url, setUrl] = React.useState("");
  const [result, setResult] = React.useState<AiVisibilityResult>();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setResult(undefined);
    setPending(true);

    try {
      const response = await fetch("/api/ai-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as AiVisibilityResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "The check failed." : payload.message);
      }
      setResult(payload.result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The check could not be completed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={submit}
        className="border-border bg-card mx-auto max-w-3xl rounded-3xl border p-5 shadow-[var(--shadow-lift)] sm:p-8"
      >
        <Label htmlFor="ai-visibility-url">Website URL</Label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            id="ai-visibility-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com"
            required
            maxLength={500}
            aria-describedby="ai-visibility-scope ai-visibility-error"
            className="h-12"
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="shrink-0"
            data-track="ai-visibility-submit"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <Search className="size-4" />
                Check visibility
              </>
            )}
          </Button>
        </div>
        <p
          id="ai-visibility-scope"
          className="text-muted-foreground mt-3 text-xs leading-relaxed"
        >
          Reads one public homepage, robots.txt, and llms.txt. No login, no
          JavaScript execution, no invasive scan.
        </p>
        {error ? (
          <p
            id="ai-visibility-error"
            role="alert"
            className="bg-destructive/10 text-destructive mt-4 rounded-xl px-4 py-3 text-sm"
          >
            {error}
          </p>
        ) : null}
      </form>

      {result ? <Results result={result} /> : null}
    </div>
  );
}

function Results({ result }: { result: AiVisibilityResult }) {
  const copy = gradeCopy[result.grade];
  const [copied, setCopied] = React.useState(false);
  const failed = result.checks.filter((check) => check.status !== "pass");
  const crawlersAllowed = result.crawlers.filter((crawler) => crawler.allowed);

  async function copySummary() {
    const summary = `AI visibility check for ${result.finalUrl}: ${result.score}/100 (${copy.label}). ${failed.length} item(s) to improve.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "AI visibility check", text: summary });
      } else {
        await navigator.clipboard.writeText(summary);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // A cancelled share sheet is not an error worth showing.
    }
  }

  return (
    <section className="mt-10" aria-labelledby="ai-visibility-results">
      <div className="border-border bg-foreground text-background rounded-3xl border p-6 shadow-[var(--shadow-lift)] sm:p-8">
        <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
          <ScoreRing score={result.score} />
          <div>
            <p className="text-background/60 text-xs font-semibold tracking-[0.16em] uppercase">
              AI visibility result
            </p>
            <h2
              id="ai-visibility-results"
              className="mt-2 text-3xl font-semibold tracking-tight"
            >
              {copy.label}
            </h2>
            <p className="text-background/65 mt-2 max-w-xl text-sm leading-relaxed">
              {copy.line}
            </p>
            <p className="text-background/50 mt-3 truncate text-sm">
              {result.finalUrl}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link
                  href={`/contact?estimate=${encodeURIComponent(
                    `My site ${result.finalUrl} scored ${result.score}/100 in the AI visibility check. I would like help with: ${failed
                      .map((check) => check.label)
                      .join(", ")}.`,
                  )}`}
                  data-track="ai-visibility-quote-click"
                >
                  Plan the fixes with us
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={copySummary}
                data-track="ai-visibility-share"
              >
                {copied ? (
                  <>
                    <Check className="size-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Share result
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric
            value={`${crawlersAllowed.length}/${result.crawlers.length}`}
            label="AI crawlers allowed"
          />
          <Metric
            value={`${result.checks.filter((check) => check.status === "pass").length}/${result.checks.length}`}
            label="Checks passed"
          />
          <Metric
            value={`${result.checks
              .filter((check) => check.status !== "pass")
              .reduce(
                (total, check) => total + (check.max - check.earned),
                0,
              )}`}
            label="Points available"
          />
        </div>
        <p className="text-background/55 mt-6 text-xs leading-relaxed">
          {result.scope}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold">What the check found</h3>
          <div className="mt-5 divide-y divide-[var(--border)]">
            {result.checks.map((check) => (
              <div key={check.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <StatusIcon status={check.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{check.label}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {check.earned}/{check.max}
                      </p>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {check.detail}
                    </p>
                    {check.status !== "pass" ? (
                      <p className="mt-2 text-sm leading-relaxed">
                        <ShieldCheck className="text-primary mr-1.5 inline size-4 shrink-0" />
                        {check.recommendation}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
            <h3 className="text-sm font-semibold">Crawler permissions</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              From robots.txt. Exact user-agent rules override wildcard rules.
            </p>
            <ul className="mt-4 space-y-2">
              {result.crawlers.map((crawler) => (
                <li
                  key={crawler.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">{crawler.name}</span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      crawler.allowed
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 text-destructive",
                    )}
                    title={crawler.reason}
                  >
                    {crawler.allowed ? "Allowed" : "Blocked"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {result.priorityFixes.length > 0 ? (
            <div className="border-primary/25 bg-primary/5 rounded-2xl border p-6">
              <h3 className="text-sm font-semibold">Fix these first</h3>
              <ol className="mt-3 space-y-3">
                {result.priorityFixes.map((fix, index) => (
                  <li key={fix.title} className="flex gap-3 text-sm">
                    <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{fix.title}</p>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {fix.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>

      <ReportEmailForm result={result} />
    </section>
  );
}

function ReportEmailForm({ result }: { result: AiVisibilityResult }) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [followUp, setFollowUp] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "pending" | "sent">("idle");
  const [message, setMessage] = React.useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setState("pending");
    try {
      const response = await fetch("/api/ai-visibility/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          url: result.finalUrl,
          followUp,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "The report could not be sent.");
      }
      setState("sent");
    } catch (caught) {
      setState("idle");
      setMessage(
        caught instanceof Error
          ? caught.message
          : "The report could not be sent.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div className="border-border bg-card mt-6 rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5 text-emerald-600" />
          Report sent
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Check your inbox for the prioritized fixes. Nothing else was
          subscribed.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-border bg-card mt-6 rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center gap-2">
        <Mail className="text-primary size-5" />
        <h3 className="text-lg font-semibold">Email me this report</h3>
      </div>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        A copy of the score and the highest-value fixes, so you can act on them
        later.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ai-report-name">Name (optional)</Label>
          <Input
            id="ai-report-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="ai-report-email">Email</Label>
          <Input
            id="ai-report-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            maxLength={254}
            className="mt-1.5"
          />
        </div>
      </div>
      <label className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-relaxed">
        <input
          type="checkbox"
          checked={followUp}
          onChange={(event) => setFollowUp(event.target.checked)}
          className="accent-primary mt-0.5 size-4"
        />
        <span>
          You may contact me about this report. Leave unticked for the report
          only.
        </span>
      </label>
      {message ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={state === "pending"}
        className="mt-4"
        data-track="ai-visibility-email-submit"
      >
        {state === "pending" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Email the report
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 55 ? "#fbbf24" : "#f87171";

  return (
    <div
      className="relative flex size-36 items-center justify-center"
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-background/12"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-semibold tabular-nums">{score}</p>
        <p className="text-background/50 text-xs">out of 100</p>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-background/8 border-background/10 rounded-2xl border p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-background/55 mt-1 text-xs">{label}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") {
    return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />;
  }
  return <XCircle className="text-destructive mt-0.5 size-5 shrink-0" />;
}
