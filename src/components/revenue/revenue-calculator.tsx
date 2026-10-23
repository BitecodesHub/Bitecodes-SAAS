"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BENCHMARK_CONVERSION_RATE,
  calculateRevenueLeak,
  formatMoney,
  type RevenueInput,
  type RevenueResult,
} from "@/lib/revenue-leak";

const defaults: RevenueInput = {
  monthlyVisitors: 5_000,
  conversionRate: 1.5,
  closeRate: 25,
  averageOrderValue: 1_500,
};

export function RevenueCalculator() {
  const [input, setInput] = React.useState<RevenueInput>(defaults);
  const result = React.useMemo(() => calculateRevenueLeak(input), [input]);

  function update(key: keyof RevenueInput, value: number) {
    if (!Number.isFinite(value)) return;
    setInput((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start">
      <div className="bg-surface-2 rounded-[28px] p-7 sm:p-9">
        <div className="flex items-center gap-2">
          <Target className="text-primary size-5" />
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">
            Your current funnel
          </h2>
        </div>
        <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
          Use your own numbers. A rough estimate is enough; the arithmetic is
          shown in the results.
        </p>

        <div className="mt-6 space-y-6">
          <SliderField
            id="monthly-visitors"
            label="Monthly visitors"
            value={input.monthlyVisitors}
            min={100}
            max={50_000}
            step={100}
            display={input.monthlyVisitors.toLocaleString("en-US")}
            hint="Sessions per month from all sources"
            onChange={(value) => update("monthlyVisitors", value)}
          />
          <SliderField
            id="conversion-rate"
            label="Enquiry rate"
            value={input.conversionRate}
            min={0.1}
            max={10}
            step={0.1}
            display={`${input.conversionRate.toFixed(1)}%`}
            hint="Share of visitors who submit a form, call, or book"
            onChange={(value) => update("conversionRate", value)}
          />
          <SliderField
            id="close-rate"
            label="Close rate"
            value={input.closeRate}
            min={1}
            max={100}
            step={1}
            display={`${input.closeRate}%`}
            hint="Share of enquiries that become customers"
            onChange={(value) => update("closeRate", value)}
          />
          <SliderField
            id="average-order-value"
            label="Average customer value"
            value={input.averageOrderValue}
            min={100}
            max={50_000}
            step={100}
            display={formatMoney(input.averageOrderValue)}
            hint="Revenue from a typical customer, first sale or annual"
            onChange={(value) => update("averageOrderValue", value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-foreground text-background rounded-[28px] p-7 sm:p-9">
          <p className="text-background/60 text-[11px] font-semibold tracking-[0.14em] uppercase">
            Current estimate
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums">
            {formatMoney(result.monthlyRevenue)}
            <span className="text-background/50 text-base font-normal">
              {" "}
              / month
            </span>
          </p>
          <p className="text-background/60 mt-1 text-[14px]">
            {formatMoney(result.annualRevenue)} per year at the current rate
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <FunnelStat
              icon={Users}
              value={result.monthlyVisitors.toLocaleString("en-US")}
              label="Visitors"
            />
            <FunnelStat
              icon={Target}
              value={result.monthlyLeads.toLocaleString("en-US")}
              label="Enquiries"
            />
            <FunnelStat
              icon={TrendingUp}
              value={result.monthlyCustomers.toLocaleString("en-US")}
              label="Customers"
            />
          </div>
        </div>

        <div className="bg-primary/5 rounded-[28px] p-7 sm:p-9">
          {result.lostMonthlyRevenue > 0 ? (
            <>
              <p className="text-primary text-[11px] font-semibold tracking-[0.14em] uppercase">
                Estimated opportunity
              </p>
              <p className="text-foreground mt-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums">
                {formatMoney(result.lostAnnualRevenue)}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / year
                </span>
              </p>
              <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                If the enquiry rate reached the {BENCHMARK_CONVERSION_RATE}%
                reference point, at the same close rate, that is{" "}
                {formatMoney(result.lostMonthlyRevenue)} more revenue each month
                — about {result.lostMonthlyLeads} additional enquiries.
              </p>
            </>
          ) : (
            <>
              <p className="text-primary text-[11px] font-semibold tracking-[0.14em] uppercase">
                Above the reference point
              </p>
              <p className="text-foreground mt-2 text-2xl font-semibold tracking-[-0.02em]">
                Your enquiry rate is {input.conversionRate.toFixed(1)}%.
              </p>
              <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                That is at or above the {BENCHMARK_CONVERSION_RATE}% reference
                used here. The scenarios below show what a further improvement
                would be worth, with no claim that it is easy.
              </p>
            </>
          )}
        </div>

        <div className="bg-surface-2 rounded-[28px] p-7">
          <h3 className="text-[16px] font-semibold">
            What a better conversion rate is worth
          </h3>
          <div className="mt-4 space-y-3">
            {result.scenarios.map((scenario) => (
              <div
                key={scenario.uplift}
                className="border-border flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-[15px] font-medium">
                    +{Math.round(scenario.uplift * 100)}% enquiry rate
                  </p>
                  <p className="text-muted-foreground text-[13px]">
                    {scenario.extraLeads.toLocaleString("en-US")} extra
                    enquiries ·{" "}
                    {scenario.extraCustomers.toLocaleString("en-US")} extra
                    customers
                  </p>
                </div>
                <p className="text-[15px] font-semibold tabular-nums">
                  +{formatMoney(scenario.extraAnnualRevenue)}
                  <span className="text-muted-foreground text-[13px] font-normal">
                    /yr
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <ReportForm result={result} input={input} />
      </div>
    </div>
  );
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <Label htmlFor={id}>{label}</Label>
          <p className="text-muted-foreground mt-0.5 text-[13px]">{hint}</p>
        </div>
        <p className="text-lg font-semibold tabular-nums">{display}</p>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary mt-3 h-2 w-full cursor-pointer"
      />
    </div>
  );
}

function FunnelStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-background/10 rounded-[16px] p-3">
      <Icon className="text-background/50 size-4" />
      <p className="mt-2 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-background/55 text-[13px]">{label}</p>
    </div>
  );
}

function ReportForm({
  result,
  input,
}: {
  result: RevenueResult;
  input: RevenueInput;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [followUp, setFollowUp] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "pending" | "sent">("idle");
  const [message, setMessage] = React.useState<string>();

  const contactHref = `/contact?estimate=${encodeURIComponent(
    `My site gets ${input.monthlyVisitors.toLocaleString("en-US")} visitors/month at a ${input.conversionRate}% enquiry rate and a ${input.closeRate}% close rate (average customer value ${formatMoney(input.averageOrderValue)}). The calculator estimated ${formatMoney(result.annualOpportunity)} per year in opportunity. I would like to discuss improving conversion.`,
  )}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setState("pending");
    try {
      const response = await fetch("/api/revenue-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          input,
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

  return (
    <div className="bg-surface-2 rounded-[28px] p-7">
      {state === "sent" ? (
        <div>
          <p className="flex items-center gap-2 text-[16px] font-semibold">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Estimate sent
          </p>
          <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
            The numbers and assumptions are in your inbox. Nothing else was
            subscribed.
          </p>
          <Button asChild variant="secondary" className="bg-background mt-4">
            <Link href={contactHref} data-track="revenue-contact">
              Talk through the numbers
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="flex items-center gap-2">
            <Mail className="text-primary size-5" />
            <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
              Email me this estimate
            </h3>
          </div>
          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
            Keep the assumptions and scenarios for your next planning
            conversation.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="revenue-name">Name (optional)</Label>
              <Input
                id="revenue-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={100}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="revenue-email">Email</Label>
              <Input
                id="revenue-email"
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
          <label className="text-muted-foreground mt-3 flex items-start gap-2 text-[13px] leading-relaxed">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(event) => setFollowUp(event.target.checked)}
              className="accent-primary mt-0.5 size-5"
            />
            <span>
              You may contact me about this estimate. Leave unticked for the
              report only.
            </span>
          </label>
          {message ? (
            <p role="alert" className="text-destructive mt-3 text-[14px]">
              {message}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={state === "pending"}
              data-track="revenue-email-submit"
            >
              {state === "pending" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  Email the estimate
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            <Button asChild variant="secondary" className="bg-background">
              <Link href={contactHref} data-track="revenue-contact">
                Discuss the fixes
              </Link>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
