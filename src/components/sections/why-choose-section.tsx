import {
  Gauge,
  Globe2,
  HeartHandshake,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

const reasons = [
  {
    icon: Gauge,
    title: "Performance obsessed",
    description:
      "We design within performance budgets from day one and routinely target near-perfect Lighthouse scores across mobile and desktop.",
    wide: true,
  },
  {
    icon: Sparkles,
    title: "Applied AI, not hype",
    description:
      "We embed AI, agentic workflows, and MCP servers where they create measurable value — with evaluation and guardrails.",
    wide: true,
  },
  {
    icon: ShieldCheck,
    title: "Built to last",
    description: "Clean architecture, tests, and observability baked in.",
  },
  {
    icon: Layers,
    title: "Full-stack ownership",
    description: "Design, frontend, backend, cloud, and DevOps in one team.",
  },
  {
    icon: Globe2,
    title: "Remote-first, worldwide",
    description: "Clear communication across time zones, by default.",
  },
  {
    icon: HeartHandshake,
    title: "A partner, not a vendor",
    description: "We stay involved long after launch, with SLA-backed support.",
  },
];

export function WhyChooseSection() {
  return (
    <Section className="border-border bg-muted/50 border-y">
      <div className="container-page">
        <SectionHeader
          eyebrow="Why Bitecodes"
          title="Senior engineering, without the agency overhead"
          description="The reasons teams choose us — and stay with us long after the first release."
        />
        <StaggerGroup className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r) => (
            <StaggerItem
              key={r.title}
              className={cn(r.wide && "lg:col-span-2")}
            >
              <div className="group gradient-ring bg-card hover:glow-primary border-border relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:shadow-[var(--shadow-lift)]">
                {r.wide && (
                  <div
                    aria-hidden="true"
                    className="bg-mesh pointer-events-none absolute inset-0 opacity-30"
                  />
                )}
                <span className="bg-primary/10 text-primary relative flex size-12 items-center justify-center rounded-xl">
                  <r.icon className="size-6" />
                </span>
                <h3 className="relative mt-5 text-lg font-semibold">
                  {r.title}
                </h3>
                <p className="text-muted-foreground relative mt-2 text-sm leading-relaxed">
                  {r.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </Section>
  );
}
