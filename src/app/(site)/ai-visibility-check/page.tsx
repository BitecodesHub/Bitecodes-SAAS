import type { Metadata } from "next";
import Link from "next/link";
import { Bot, FileText, ScanSearch, Sparkles } from "lucide-react";
import { AiVisibilityTool } from "@/components/ai-visibility/ai-visibility-tool";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  webPageSchema,
} from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "AI Visibility Check — Can AI Search Read Your Site?",
  description:
    "Free check of the signals ChatGPT, Claude, Perplexity, and AI search crawlers read: crawler access, llms.txt, structured data, metadata, and answer structure.",
  path: "/ai-visibility-check",
});

const faqs = [
  {
    question: "What is an AI visibility check?",
    answer:
      "It reviews the public signals an AI crawler or answer engine can read from your site: whether it is allowed in robots.txt, whether an llms.txt summary exists, whether structured data identifies the business, and whether the page is written and marked up in a way a model can quote. It does not measure a ranking inside ChatGPT or any other model.",
  },
  {
    question: "How is this different from SEO?",
    answer:
      "Classic SEO optimises a page to appear in a list of search results. AI visibility adds machine-readable context — entity types, a clean summary file, and direct answer-first paragraphs — so a model can extract and cite the page in a generated answer. The fundamentals overlap: crawlability, clear headings, fast delivery, and accurate metadata still matter.",
  },
  {
    question: "Does blocking AI crawlers affect my site?",
    answer:
      "Yes. If robots.txt disallows GPTBot, ClaudeBot, PerplexityBot, or Google-Extended, those crawlers may not read the page at all, so they cannot cite it. Some site owners block training crawlers deliberately; the check separates the decision from accidental blocking so you can make it on purpose.",
  },
  {
    question: "Is an llms.txt file required?",
    answer:
      "No. It is an emerging convention, not an official standard, and no major AI provider guarantees that it reads one. It is still a low-cost, high-signal way to publish a concise, factual summary of the company, services, prices, and key pages in one place.",
  },
];

const principles = [
  {
    icon: ScanSearch,
    title: "Reads what crawlers read",
    description:
      "The initial HTML, robots.txt, and llms.txt — not a JavaScript-rendered approximation.",
  },
  {
    icon: Bot,
    title: "Names the crawlers",
    description:
      "Shows exactly which AI crawlers are allowed or blocked, and the rule that decided it.",
  },
  {
    icon: FileText,
    title: "Prioritised, not overwhelming",
    description:
      "Seven checks, scored out of 100, with the three highest-value fixes first.",
  },
];

export default function AiVisibilityCheckPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: "AI visibility check", path: "/ai-visibility-check" },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path: "/ai-visibility-check",
          name: "AI visibility check",
          description:
            "A free public check of the signals AI crawlers and answer engines can read from a website.",
          speakableSelectors: ["h1", "main p:first-of-type"],
        })}
      />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Bitecodes AI Visibility Check",
          description:
            "Checks crawler access, llms.txt, structured data, metadata, answer structure, and social preview for AI discoverability.",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />

      <PageHeader
        eyebrow="Free AI visibility check"
        title={
          <>
            Get found by <span>AI search.</span>
          </>
        }
        description="When someone asks ChatGPT, Claude, or Perplexity for a recommendation, the model can only cite what it can read. Check the signals that decide whether your site is in that conversation."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          { name: "AI visibility check", href: "/ai-visibility-check" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page grid gap-3 sm:grid-cols-3">
          {principles.map((principle) => (
            <div
              key={principle.title}
              className="bg-surface-2 flex gap-4 rounded-[24px] p-6"
            >
              <span className="bg-background text-primary flex size-11 shrink-0 items-center justify-center rounded-[14px]">
                <principle.icon className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
                  {principle.title}
                </h2>
                <p className="text-muted-foreground mt-1.5 text-[14px] leading-[1.55]">
                  {principle.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-surface-2" spacing="sm">
        <div className="container-page">
          <AiVisibilityTool />
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-primary text-[11px] font-semibold tracking-[0.14em] uppercase">
              What this measures
            </p>
            <h2 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
              The difference between being online and being citable
            </h2>
            <div className="text-muted-foreground mt-5 space-y-4 text-[16px] leading-[1.65]">
              <p>
                Search engines rank links. Answer engines assemble an answer
                from sources they can parse and trust. A page can rank well in
                Google and still be invisible in an AI answer if its key facts
                are buried in images, locked behind blocked crawlers, or
                described in ambiguous marketing language.
              </p>
              <p>
                The check scores seven public signals: crawler access, llms.txt,
                structured data, answer structure, metadata, social preview, and
                HTTPS. Each finding names the evidence and a concrete next step
                — no black-box grade.
              </p>
              <p>
                It is deliberately limited. It does not execute JavaScript,
                crawl the whole site, or claim to know how a specific model
                ranks anything. For a full technical and content review, use the{" "}
                <Link
                  href="/website-audit"
                  className="text-primary underline underline-offset-4"
                >
                  website audit
                </Link>{" "}
                or talk to us.
              </p>
            </div>
          </div>

          <div className="bg-surface-2 rounded-[28px] p-7">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary size-5" />
              <h2 className="text-[19px] font-semibold tracking-[-0.01em]">
                The seven signals, weighted
              </h2>
            </div>
            <ul className="mt-4 text-[15px]">
              {[
                ["AI crawler access", "25"],
                ["Structured data", "20"],
                ["Page metadata", "15"],
                ["Answer structure", "15"],
                ["llms.txt summary", "10"],
                ["Secure delivery", "10"],
                ["Social preview", "5"],
              ].map(([label, points]) => (
                <li
                  key={label}
                  className="border-background flex items-center justify-between border-b py-3 last:border-0 last:pb-0"
                >
                  <span>{label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {points} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section className="bg-surface-2" spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <h2 className="text-center text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            Questions, answered
          </h2>
          <dl className="mt-10 space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-[16px] font-semibold">{faq.question}</dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-[1.65]">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>
    </>
  );
}
