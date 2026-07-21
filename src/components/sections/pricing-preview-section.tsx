import Link from "next/link";
import { ArrowRight, Calculator, Check } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { Button } from "@/components/ui/button";
import { formatPrice, getPricing } from "@/lib/pricing";

const packages = [
  {
    slug: "website-development",
    title: "Marketing & business websites",
    timeline: "Typically 4–8 weeks",
    includes: [
      "Discovery and information architecture",
      "Responsive product design",
      "SEO, accessibility, QA, and launch",
    ],
  },
  {
    slug: "web-applications",
    title: "Web applications",
    timeline: "Typically 10–18 weeks",
    includes: [
      "Product and workflow discovery",
      "Frontend, backend, and data foundations",
      "Testing, deployment, and handover",
    ],
  },
  {
    slug: "ai-integration",
    title: "AI integration & automation",
    timeline: "Typically 8–16 weeks",
    includes: [
      "Use-case and risk validation",
      "Provider and workflow integration",
      "Evaluation, guardrails, and monitoring plan",
    ],
  },
];

export function PricingPreviewSection() {
  return (
    <Section>
      <div className="container-page">
        <SectionHeader
          eyebrow="Indicative pricing"
          title="Plan with visible starting points"
          description="Compare common engagement types, then configure a project-specific INR range with the free calculator. Final scope and commercial terms follow discovery."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {packages.map((item) => {
            const pricing = getPricing(item.slug)!;
            return (
              <article
                key={item.slug}
                className="border-border bg-card flex flex-col rounded-3xl border p-6 shadow-[var(--shadow-soft)]"
              >
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {pricing.model}
                </p>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-5 text-3xl font-semibold tracking-tight">
                  From {formatPrice(pricing.startingFromUSD, "INR")}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {item.timeline} · scoped per project
                </p>
                <ul className="text-muted-foreground mt-6 flex-1 space-y-3 text-sm">
                  {item.includes.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-7">
                  <Link href={`/services/${item.slug}`}>
                    View service
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg">
            <Link href="/project-cost-calculator">
              <Calculator className="size-4" />
              Calculate project cost
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">View all service pricing</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
