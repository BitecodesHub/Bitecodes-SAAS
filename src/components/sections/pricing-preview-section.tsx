import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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
    <Section className="bg-surface-2">
      <div className="container-page">
        <SectionHeader
          eyebrow="Indicative pricing"
          title="Plan with visible starting points"
          description="Compare common engagement types, then configure a project-specific INR range with the free calculator. Final scope and commercial terms follow discovery."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {packages.map((item) => {
            const pricing = getPricing(item.slug)!;
            return (
              <article
                key={item.slug}
                className="bg-background flex flex-col rounded-[28px] p-7 shadow-[var(--shadow-soft)] sm:p-8"
              >
                <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.06em] uppercase">
                  {pricing.model}
                </p>
                <h3 className="mt-3 text-[23px] font-semibold tracking-[-0.025em]">
                  {item.title}
                </h3>
                <p className="mt-6 text-[36px] leading-none font-semibold tracking-[-0.04em]">
                  From {formatPrice(pricing.startingFromUSD, "INR")}
                </p>
                <p className="text-muted-foreground mt-2 text-[14px]">
                  {item.timeline} · scoped per project
                </p>
                <ul className="text-muted-foreground mt-7 flex-1 space-y-3 text-[15px]">
                  {item.includes.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <Check
                        className="text-primary mt-0.5 size-4 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="secondary" className="mt-8">
                  <Link href={`/services/${item.slug}`}>
                    View service
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href="/pricing"
            className="text-primary inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium transition-opacity hover:opacity-75"
          >
            View all service pricing
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}
