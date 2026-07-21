"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  IndianRupee,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  consultantSummary,
  type ConsultantInput,
  type ConsultantRecommendation,
  type ConsultantResponse,
} from "@/lib/ai-consultant";
import type { ProjectEstimate } from "@/lib/cost-estimator";

const initialInput: ConsultantInput = {
  projectType: "saas",
  stage: "idea",
  goals: "",
  audience: "",
  mustHaveFeatures: "",
  budget: "not-sure",
  timeline: "flexible",
};

export function ProjectConsultant() {
  const [input, setInput] = React.useState(initialInput);
  const [recommendation, setRecommendation] =
    React.useState<ConsultantRecommendation>();
  const [quote, setQuote] = React.useState<ProjectEstimate>();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setRecommendation(undefined);
    setPending(true);
    try {
      const response = await fetch("/api/ai/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as ConsultantResponse;
      if (!response.ok || !result.ok) {
        throw new Error(
          result.ok ? "The consultant is unavailable." : result.message,
        );
      }
      setRecommendation(result.recommendation);
      setQuote(result.quote);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The consultant is unavailable.",
      );
    } finally {
      setPending(false);
    }
  }

  if (recommendation && quote) {
    return (
      <Recommendation
        recommendation={recommendation}
        quote={quote}
        onReset={() => {
          setRecommendation(undefined);
          setQuote(undefined);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-border bg-card mx-auto max-w-4xl rounded-3xl border p-5 shadow-[var(--shadow-lift)] sm:p-8"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          label="What are you planning?"
          value={input.projectType}
          onChange={(projectType) =>
            setInput((current) => ({
              ...current,
              projectType: projectType as ConsultantInput["projectType"],
            }))
          }
          options={[
            ["website", "Website"],
            ["ecommerce", "eCommerce"],
            ["web-app", "Web application"],
            ["saas", "SaaS product"],
            ["mobile-app", "Mobile app"],
            ["enterprise", "Enterprise platform"],
            ["ai-automation", "AI or automation"],
            ["not-sure", "Not sure yet"],
          ]}
        />
        <SelectField
          label="Current stage"
          value={input.stage}
          onChange={(stage) =>
            setInput((current) => ({
              ...current,
              stage: stage as ConsultantInput["stage"],
            }))
          }
          options={[
            ["idea", "Idea"],
            ["validation", "Validating demand"],
            ["existing-product", "Existing product"],
            ["scaling", "Scaling or modernizing"],
          ]}
        />
        <div className="sm:col-span-2">
          <Label htmlFor="consultant-goals">Business goal</Label>
          <Textarea
            id="consultant-goals"
            rows={4}
            value={input.goals}
            onChange={(event) =>
              setInput((current) => ({ ...current, goals: event.target.value }))
            }
            minLength={30}
            maxLength={1600}
            required
            className="mt-2"
            placeholder="What outcome should this product create, and what problem does it solve?"
          />
        </div>
        <div>
          <Label htmlFor="consultant-audience">Who will use it?</Label>
          <Input
            id="consultant-audience"
            value={input.audience}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                audience: event.target.value,
              }))
            }
            minLength={3}
            maxLength={300}
            required
            className="mt-2"
            placeholder="Customers, staff, partners…"
          />
        </div>
        <div>
          <Label htmlFor="consultant-features">Must-have capabilities</Label>
          <Input
            id="consultant-features"
            value={input.mustHaveFeatures}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                mustHaveFeatures: event.target.value,
              }))
            }
            minLength={3}
            maxLength={800}
            required
            className="mt-2"
            placeholder="Accounts, payments, admin, AI…"
          />
        </div>
        <SelectField
          label="Planning budget"
          value={input.budget}
          onChange={(budget) =>
            setInput((current) => ({
              ...current,
              budget: budget as ConsultantInput["budget"],
            }))
          }
          options={[
            ["under-2-lakh", "Under ₹2 lakh"],
            ["2-5-lakh", "₹2–5 lakh"],
            ["5-15-lakh", "₹5–15 lakh"],
            ["15-40-lakh", "₹15–40 lakh"],
            ["40-lakh-plus", "₹40 lakh+"],
            ["not-sure", "Not sure yet"],
          ]}
        />
        <SelectField
          label="Target timeline"
          value={input.timeline}
          onChange={(timeline) =>
            setInput((current) => ({
              ...current,
              timeline: timeline as ConsultantInput["timeline"],
            }))
          }
          options={[
            ["under-8-weeks", "Under 8 weeks"],
            ["2-4-months", "2–4 months"],
            ["4-8-months", "4–8 months"],
            ["flexible", "Flexible"],
          ]}
        />
      </div>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
          Do not include passwords, API keys, personal identifiers, health
          records, payment details, or confidential data. Your brief is sent to
          an AI provider to generate this response and is not intentionally
          stored by Bitecodes in this flow.
        </p>
        <Button
          type="submit"
          variant="gradient"
          size="lg"
          disabled={pending}
          className="shrink-0"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Building recommendation…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate recommendation
            </>
          )}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive mt-5 rounded-xl px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Recommendation({
  recommendation,
  quote,
  onReset,
}: {
  recommendation: ConsultantRecommendation;
  quote: ProjectEstimate;
  onReset: () => void;
}) {
  const contactHref = `/contact?estimate=${encodeURIComponent(`${consultantSummary(recommendation, quote)} I would like a detailed human-reviewed proposal.`)}`;
  return (
    <section
      aria-live="polite"
      className="border-border bg-card rounded-3xl border shadow-[var(--shadow-lift)]"
    >
      <div className="bg-foreground text-background rounded-t-3xl p-6 sm:p-8">
        <p className="text-background/60 text-xs font-semibold tracking-[0.16em] uppercase">
          AI-assisted, human-reviewed next
        </p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">
              {recommendation.recommendedPackage}
            </h2>
            <p className="text-background/70 mt-2 max-w-2xl leading-relaxed">
              {recommendation.summary}
            </p>
          </div>
          <Button asChild variant="gradient">
            <Link href={contactHref}>
              Request detailed proposal
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={IndianRupee}
            label="Indicative investment"
            value={`₹${quote.minimum.toLocaleString("en-IN")}–₹${quote.maximum.toLocaleString("en-IN")}`}
          />
          <Metric
            icon={Clock3}
            label="Delivery"
            value={`${quote.timelineMinWeeks}–${quote.timelineMaxWeeks} weeks`}
          />
          <Metric icon={Users} label="Team" value={quote.teamSize} />
        </div>
      </div>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
        <List title="Recommended scope" items={recommendation.scope} />
        <List
          title="Technology direction"
          items={recommendation.technologyStack}
        />
        <List
          title="Recommended services"
          items={recommendation.recommendedServices}
        />
        <List title="Assumptions" items={recommendation.assumptions} />
        {recommendation.clarifyingQuestions.length ? (
          <List
            title="Questions for discovery"
            items={recommendation.clarifyingQuestions}
          />
        ) : null}
        {recommendation.addOns.length ? (
          <List title="Optional add-ons" items={recommendation.addOns} />
        ) : null}
        <div className="border-border flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
          <p className="text-muted-foreground text-sm">
            {recommendation.nextStep}
          </p>
          <Button type="button" variant="outline" onClick={onReset}>
            <RefreshCw className="size-4" />
            Start over
          </Button>
        </div>
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 mt-2 h-11 w-full rounded-xl border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-background/8 border-background/10 rounded-2xl border p-4">
      <Icon className="size-4" />
      <p className="text-background/55 mt-3 text-xs">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="text-primary mt-0.5 size-4 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
