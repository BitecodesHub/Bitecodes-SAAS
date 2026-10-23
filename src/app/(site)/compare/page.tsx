import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
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
          <div className="bg-surface-2 rounded-[28px] p-7 sm:p-9">
            <div className="flex items-center gap-2.5">
              <Scale className="text-primary size-5" />
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">
                A quick shortcut
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 text-[15px] leading-[1.5]">
              If the job is one of these, start there — not with us.
            </p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {shortcuts.map((shortcut) => (
                <li
                  key={shortcut.need}
                  className="bg-background rounded-[18px] p-4"
                >
                  <p className="text-muted-foreground text-[13px] leading-[1.45]">
                    {shortcut.need}
                  </p>
                  <p className="mt-2 text-[15px] font-semibold">
                    {shortcut.pick}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-2">
            {comparisonPages.map((page, index) => (
              <Reveal key={page.slug} delay={index * 40}>
                <Link
                  href={`/compare/${page.slug}`}
                  className="group bg-surface-2 hover:bg-background flex h-full flex-col rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
                  data-track="comparison-card"
                >
                  <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.12em] uppercase">
                    Bitecodes vs {page.alternativeName}
                  </p>
                  <h2 className="group-hover:text-primary mt-3 text-[21px] leading-[1.25] font-semibold tracking-[-0.015em] transition-colors">
                    {page.title}
                  </h2>
                  <p className="text-muted-foreground mt-2.5 line-clamp-3 flex-1 text-[15px] leading-[1.55]">
                    {page.shortAnswer}
                  </p>
                  <span className="text-primary mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium">
                    Read the comparison
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-[13px] leading-[1.6]">
            Comparisons describe typical engagement models as of October 2026.
            Prices for other providers vary by scope and region. Where we are
            not the best fit, we say so.
          </p>
        </div>
      </Section>

      <CtaSection
        title="Still not sure which fits?"
        description="Describe the outcome and the constraint. A short call is usually enough to choose the right model, even when the answer is not us."
        primary={{
          label: "Book a free call",
          href: "/book-a-call",
          track: "compare-book-call",
        }}
        secondary={{
          label: "Read the answer library",
          href: "/answers",
          track: "compare-answers",
        }}
      />
    </>
  );
}
