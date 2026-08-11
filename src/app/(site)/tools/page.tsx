import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Calculator, Gauge, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
import { Button } from "@/components/ui/button";
import { calculatorPages } from "@/data/calculator-pages";
import { breadcrumbSchema, createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Free Software Planning & Website Audit Tools",
  description:
    "Free Bitecodes tools for software cost planning, website and mobile app estimates, startup MVP scoping, SEO, performance, accessibility, and security audits.",
  path: "/tools",
});

const plannedTools = [
  {
    icon: ShieldCheck,
    title: "Ownership-verified security review",
    description:
      "Deeper authenticated checks after domain ownership and written authorization are confirmed.",
  },
];

export default function ToolsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
        ])}
      />
      <PageHeader
        eyebrow="Free tools"
        title={
          <>
            Plan smarter before you <span>spend.</span>
          </>
        }
        description="Practical, no-login tools for estimating software investment and understanding what a production-ready project involves."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
        ]}
      />
      <Section>
        <div className="container-page">
          <SectionHeader
            eyebrow="Cost calculators"
            title="Get a useful range in minutes"
            description="Every calculator uses the same transparent delivery model, with a preset tailored to the decision you are making."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <ToolCard
              href="/project-cost-calculator"
              title="Software project cost calculator"
              description="Compare websites, apps, SaaS, enterprise systems, and AI automation in one configurable tool."
              featured
            />
            {calculatorPages.map((tool) => (
              <ToolCard
                key={tool.slug}
                href={`/${tool.slug}`}
                title={tool.title}
                description={tool.description}
              />
            ))}
          </div>
        </div>
      </Section>
      <Section className="border-border bg-secondary/35 border-y">
        <div className="container-page">
          <SectionHeader
            eyebrow="Website intelligence"
            title="Find practical improvements without an invasive scan"
            description="The public audit reads one public webpage and its response headers, with strict destination, redirect, timeout, and response-size controls."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <article className="border-primary/30 bg-primary/5 rounded-2xl border p-6">
              <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                <Gauge className="size-5" />
              </span>
              <p className="text-muted-foreground mt-5 text-xs font-semibold tracking-[0.16em] uppercase">
                Available now
              </p>
              <h2 className="mt-4 text-lg font-semibold">
                Website audit & improvement report
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Review initial SEO, response performance, accessibility markup,
                HTTPS, and defensive headers with clear limitations.
              </p>
              <Button asChild className="mt-6">
                <Link href="/website-audit">
                  Run free audit
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </article>
            <article className="border-primary/30 bg-card rounded-2xl border p-6">
              <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                <Bot className="size-5" />
              </span>
              <p className="text-muted-foreground mt-5 text-xs font-semibold tracking-[0.16em] uppercase">
                Available now
              </p>
              <h2 className="mt-4 text-lg font-semibold">
                AI project consultant
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Turn a project brief into a structured service, scope,
                technology, budget, timeline, and team recommendation.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/ai-project-consultant">
                  Consult AI assistant
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </article>
            {plannedTools.map((tool) => (
              <div
                key={tool.title}
                className="border-border bg-card rounded-2xl border p-6"
              >
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <tool.icon className="size-5" />
                </span>
                <p className="text-muted-foreground/70 mt-5 text-xs font-semibold tracking-[0.16em] uppercase">
                  In development
                </p>
                <h2 className="mt-4 text-lg font-semibold">{tool.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

function ToolCard({
  href,
  title,
  description,
  featured = false,
}: {
  href: string;
  title: string;
  description: string;
  featured?: boolean;
}) {
  return (
    <article
      className={
        featured
          ? "border-primary/30 bg-primary/5 rounded-3xl border p-7 md:col-span-2"
          : "border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-soft)]"
      }
    >
      <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl">
        <Calculator className="size-5" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        {description}
      </p>
      <Button
        asChild
        variant={featured ? "default" : "outline"}
        className="mt-6"
      >
        <Link href={href}>
          Open calculator
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </article>
  );
}
