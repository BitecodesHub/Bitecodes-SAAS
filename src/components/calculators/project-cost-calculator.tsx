"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, IndianRupee, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculateProjectEstimate,
  complexityLevels,
  estimateSummary,
  estimatorFeatures,
  formatInr,
  projectTypes,
  type EstimateInput,
} from "@/lib/cost-estimator";
import { cn } from "@/lib/utils";

export const defaultEstimateInput: EstimateInput = {
  projectType: "saas-mvp",
  complexity: "growth",
  platforms: 1,
  features: ["custom-design", "authentication", "admin"],
  urgency: "standard",
  support: "quarter",
};

export function ProjectCostCalculator({
  initialInput = defaultEstimateInput,
  lockProjectType = false,
}: {
  initialInput?: EstimateInput;
  lockProjectType?: boolean;
}) {
  const [input, setInput] = React.useState<EstimateInput>(initialInput);
  const estimate = React.useMemo(
    () => calculateProjectEstimate(input),
    [input],
  );
  const contactHref = `/contact?estimate=${encodeURIComponent(estimateSummary(input, estimate))}`;

  function toggleFeature(feature: EstimateInput["features"][number]) {
    setInput((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((item) => item !== feature)
        : [...current.features, feature],
    }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
      <form
        className="bg-surface-2 space-y-8 rounded-[28px] p-6 sm:p-9"
        onSubmit={(event) => event.preventDefault()}
      >
        {lockProjectType ? (
          <div className="bg-background rounded-[20px] p-4">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
              Project type
            </p>
            <p className="mt-1 text-[15px] font-semibold">
              {
                projectTypes.find(
                  (project) => project.value === input.projectType,
                )?.label
              }
            </p>
          </div>
        ) : (
          <EstimatorSection legend="1. What are you building?">
            <div className="grid gap-3 sm:grid-cols-2">
              {projectTypes.map((project) => (
                <ChoiceCard
                  key={project.value}
                  name="projectType"
                  checked={input.projectType === project.value}
                  label={project.label}
                  onChange={() =>
                    setInput((current) => ({
                      ...current,
                      projectType: project.value,
                    }))
                  }
                />
              ))}
            </div>
          </EstimatorSection>
        )}

        <EstimatorSection
          legend={`${lockProjectType ? "1" : "2"}. How ambitious is the first release?`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {complexityLevels.map((level) => (
              <ChoiceCard
                key={level.value}
                name="complexity"
                checked={input.complexity === level.value}
                label={level.label}
                description={
                  level.value === "essential"
                    ? "Focused core workflow"
                    : level.value === "growth"
                      ? "Polished, scalable release"
                      : "Complex operations and scale"
                }
                onChange={() =>
                  setInput((current) => ({
                    ...current,
                    complexity: level.value,
                  }))
                }
              />
            ))}
          </div>
        </EstimatorSection>

        <EstimatorSection
          legend={`${lockProjectType ? "2" : "3"}. Which capabilities do you need?`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {estimatorFeatures.map((feature) => {
              const checked = input.features.includes(feature.value);
              return (
                <label
                  key={feature.value}
                  className={cn(
                    "bg-background flex min-h-12 cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 text-[15px] transition-colors",
                    checked && "bg-primary/10",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFeature(feature.value)}
                    className="accent-primary size-5"
                  />
                  <span className="flex-1 font-medium">{feature.label}</span>
                  {checked ? (
                    <Check className="text-primary size-4" aria-hidden="true" />
                  ) : null}
                </label>
              );
            })}
          </div>
        </EstimatorSection>

        <div className="grid gap-6 sm:grid-cols-3">
          <SelectField
            label="Platforms"
            value={String(input.platforms)}
            onChange={(value) =>
              setInput((current) => ({ ...current, platforms: Number(value) }))
            }
            options={[
              { value: "1", label: "One" },
              { value: "2", label: "Two" },
              { value: "3", label: "Three" },
            ]}
          />
          <SelectField
            label="Delivery"
            value={input.urgency}
            onChange={(value) =>
              setInput((current) => ({
                ...current,
                urgency: value as EstimateInput["urgency"],
              }))
            }
            options={[
              { value: "standard", label: "Standard" },
              { value: "priority", label: "Priority" },
            ]}
          />
          <SelectField
            label="Support"
            value={input.support}
            onChange={(value) =>
              setInput((current) => ({
                ...current,
                support: value as EstimateInput["support"],
              }))
            }
            options={[
              { value: "launch", label: "Launch only" },
              { value: "quarter", label: "3 months" },
              { value: "annual", label: "12 months" },
            ]}
          />
        </div>
      </form>

      <aside
        aria-live="polite"
        aria-atomic="true"
        className="bg-foreground text-background overflow-hidden rounded-[28px] p-7 sm:p-9 lg:sticky lg:top-24"
      >
        <p className="text-background/65 text-[11px] font-semibold tracking-[0.14em] uppercase">
          Indicative investment
        </p>
        <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance tabular-nums sm:text-4xl">
          {formatInr(estimate.minimum)}–{formatInr(estimate.maximum)}
        </p>
        <p className="text-background/65 mt-2 text-[14px]">
          Excluding GST and third-party charges
        </p>
        <div className="bg-background/8 mt-7 grid gap-4 rounded-[20px] p-5">
          <ResultRow
            icon={Clock3}
            label="Delivery"
            value={`${estimate.timelineMinWeeks}–${estimate.timelineMaxWeeks} weeks`}
          />
          <ResultRow
            icon={Users}
            label="Suggested team"
            value={estimate.teamSize}
          />
          <ResultRow
            icon={IndianRupee}
            label="Pricing model"
            value="Scoped fixed quote"
          />
        </div>
        <ul className="text-background/70 mt-6 space-y-3 text-[15px] leading-[1.55]">
          {estimate.assumptions.map((assumption) => (
            <li key={assumption} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0" />
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
        <Button asChild size="lg" className="mt-7 w-full">
          <Link href={contactHref}>
            Get a detailed quote
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <p className="text-background/55 mt-4 text-center text-[13px]">
          No sign-up required. Your configuration is only shared when you
          contact us.
        </p>
      </aside>
    </div>
  );
}

function EstimatorSection({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-4 text-[16px] font-semibold tracking-[-0.01em]">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function ChoiceCard({
  name,
  checked,
  label,
  description,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  description?: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "bg-background cursor-pointer rounded-[20px] p-4 transition-colors",
        "has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
        checked && "bg-primary/10",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-2">
        <span>
          <span className="block text-[15px] font-semibold">{label}</span>
          {description ? (
            <span className="text-muted-foreground mt-1 block text-[13px]">
              {description}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "bg-surface-2 mt-0.5 flex size-5 items-center justify-center rounded-full",
            checked && "bg-primary text-primary-foreground",
          )}
        >
          {checked ? <Check className="size-3" /> : null}
        </span>
      </span>
    </label>
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
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-[14px] border px-3 text-[15px] focus-visible:ring-2 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResultRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-background/10 flex size-10 items-center justify-center rounded-[14px]">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="text-background/55 block text-[13px]">{label}</span>
        <strong className="text-[15px] font-medium">{value}</strong>
      </span>
    </div>
  );
}
