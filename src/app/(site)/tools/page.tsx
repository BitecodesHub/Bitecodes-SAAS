import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calculator,
  Gauge,
  LayoutTemplate,
  Library,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Laptop,
} from "lucide-react";
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
          <div className="mt-14 grid gap-3 md:grid-cols-2">
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
      <Section className="bg-surface-2">
        <div className="container-page">
          <SectionHeader
            eyebrow="Website intelligence"
            title="Find practical improvements without an invasive scan"
            description="The public audit reads one public webpage and its response headers, with strict destination, redirect, timeout, and response-size controls."
          />
          <div className="mt-14 grid gap-3 md:grid-cols-2">
            <article className="bg-background rounded-[28px] p-7">
              <span className="bg-surface-2 text-primary flex size-11 items-center justify-center rounded-[14px]">
                <Gauge className="size-5" />
              </span>
              <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                Available now
              </p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">
                Website audit & improvement report
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
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
            <article className="bg-background rounded-[28px] p-7">
              <span className="bg-surface-2 text-primary flex size-11 items-center justify-center rounded-[14px]">
                <Bot className="size-5" />
              </span>
              <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                Available now
              </p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">
                AI project consultant
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                Turn a project brief into a structured service, scope,
                technology, budget, timeline, and team recommendation.
              </p>
              <Button asChild variant="secondary" className="bg-surface-2 mt-6">
                <Link href="/ai-project-consultant">
                  Consult AI assistant
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </article>
            <article className="bg-background rounded-[28px] p-7">
              <span className="bg-surface-2 text-primary flex size-11 items-center justify-center rounded-[14px]">
                <Laptop className="size-5" />
              </span>
              <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                Free download
              </p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">
                Notes — AI desktop app
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                A free AI assistant for Mac and Windows: explain anything on
                your screen, chat, or ask by voice.
              </p>
              <Button asChild variant="secondary" className="bg-surface-2 mt-6">
                <Link href="/notes">
                  Download Notes free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </article>
            {plannedTools.map((tool) => (
              <div
                key={tool.title}
                className="bg-background rounded-[28px] p-7"
              >
                <span className="bg-surface-2 text-primary flex size-11 items-center justify-center rounded-[14px]">
                  <tool.icon className="size-5" />
                </span>
                <p className="text-muted-foreground/70 mt-5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                  In development
                </p>
                <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">
                  {tool.title}
                </h2>
                <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section spacing="sm">
        <div className="container-page">
          <SectionHeader
            eyebrow="AI search & growth"
            title="Find where the next customer is"
            description="Check how AI search sees your site, estimate what a better conversion rate is worth, and start from a design direction that is already thought through."
          />
          <div className="mt-14 grid gap-3 md:grid-cols-3">
            <ToolCard
              href="/ai-visibility-check"
              title="AI visibility check"
              description="See whether GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers can read your site — and what to fix first."
              icon={Sparkles}
              cta="Run the free check"
            />
            <ToolCard
              href="/revenue-leak-calculator"
              title="Revenue leak calculator"
              description="Estimate what your current enquiry rate is leaving on the table at your traffic, close rate, and customer value."
              icon={TrendingUp}
              cta="Open calculator"
            />
            <ToolCard
              href="/templates"
              title="Launch templates"
              description="Three original website directions with live, responsive previews for clinics, restaurants, and SaaS."
              icon={LayoutTemplate}
              cta="Browse templates"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ToolCard
              href="/answers"
              title="Answer library"
              description="Clear, current answers to the questions buyers ask about cost, timelines, hiring, and AI search."
              icon={Library}
              cta="Browse answers"
            />
            <ToolCard
              href="/compare"
              title="Compare your options"
              description="Honest comparisons with freelancers, agencies, website builders, Webflow, and in-house teams — including where each wins."
              icon={Scale}
              cta="Compare options"
            />
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
  icon: Icon = Calculator,
  cta = "Open calculator",
}: {
  href: string;
  title: string;
  description: string;
  featured?: boolean;
  icon?: typeof Calculator;
  cta?: string;
}) {
  return (
    <article
      className={
        featured
          ? "bg-foreground text-background rounded-[28px] p-7 md:col-span-2"
          : "bg-surface-2 rounded-[28px] p-7"
      }
    >
      <span
        className={
          featured
            ? "flex size-11 items-center justify-center rounded-[14px] bg-white/10 text-white"
            : "bg-background text-primary flex size-11 items-center justify-center rounded-[14px]"
        }
      >
        <Icon className="size-5" />
      </span>
      <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p
        className={
          featured
            ? "text-background/70 mt-2 max-w-2xl text-[15px] leading-[1.55]"
            : "text-muted-foreground mt-2 max-w-2xl text-[15px] leading-[1.55]"
        }
      >
        {description}
      </p>
      <Button
        asChild
        variant={featured ? "secondary" : "outline"}
        className={
          featured ? "mt-6 bg-white text-[#1d1d1f] hover:bg-white/90" : "mt-6"
        }
      >
        <Link href={href}>
          {cta}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </article>
  );
}
