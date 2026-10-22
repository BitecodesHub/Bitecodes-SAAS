import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { comparisonPages } from "@/data/comparisons";
import { breadcrumbSchema, createMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Compare Your Options — Freelancer, Agency, Builder, or Studio",
  description:
    "Honest comparisons of Bitecodes with freelancers, agencies, website builders, Webflow, and in-house teams, including where each option wins.",
  path: "/compare",
});

const shortcuts = [
  {
    need: "A small task with a tight budget",
    pick: "A freelancer",
  },
  {
    need: "A simple brochure site this week",
    pick: "Wix or Squarespace",
  },
  {
    need: "A design-led marketing site",
    pick: "Webflow",
  },
  {
    need: "A large multi-channel campaign",
    pick: "A traditional agency",
  },
  {
    need: "Continuous product iteration for years",
    pick: "An in-house team",
  },
];

export default function ComparePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path: "/compare",
          name: "Compare software development options",
          description:
            "Honest comparisons of a software studio with freelancers, agencies, website builders, Webflow, and in-house teams.",
        })}
      />
      <PageHeader
        eyebrow="Compare options"
        title={
          <>
            The right choice depends on the <span>job.</span>
          </>
        }
        description="A studio is not the answer to every problem. These comparisons state where each option wins, including the cases where Bitecodes is not the best fit."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Compare", href: "/compare" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="border-border bg-card rounded-3xl border p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="flex items-center gap-2">
              <Scale className="text-primary size-5" />
              <h2 className="text-lg font-semibold">A quick shortcut</h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              If the job is one of these, start there — not with us.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {shortcuts.map((shortcut) => (
                <li
                  key={shortcut.need}
                  className="border-border bg-secondary/50 rounded-2xl border p-4"
                >
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {shortcut.need}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{shortcut.pick}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {comparisonPages.map((page, index) => (
              <Reveal key={page.slug} delay={index * 40}>
                <Link
                  href={`/compare/${page.slug}`}
                  className="group border-border bg-card hover:border-primary/30 flex h-full flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
                  data-track="comparison-card"
                >
                  <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                    Bitecodes vs {page.alternativeName}
                  </p>
                  <h2 className="group-hover:text-primary mt-3 text-xl leading-snug font-semibold">
                    {page.title}
                  </h2>
                  <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
                    {page.shortAnswer}
                  </p>
                  <span className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-medium">
                    Read the comparison
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed">
            Comparisons describe typical engagement models as of October 2026.
            Prices for other providers vary by scope and region. Where we are
            not the best fit, we say so.
          </p>
        </div>
      </Section>

      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Still not sure which fits?
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-relaxed">
            Describe the outcome and the constraint. A short call is usually
            enough to choose the right model, even when the answer is not us.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/book-a-call" data-track="compare-book-call">
                Book a free call
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/answers">Read the answer library</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
