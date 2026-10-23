import type { Metadata } from "next";
import { Gauge, ShieldCheck, TrendingUp } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { RevenueCalculator } from "@/components/revenue/revenue-calculator";
import { Section } from "@/components/section";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  webPageSchema,
} from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Revenue Leak Calculator — What Is Your Website Leaving on the Table?",
  description:
    "Estimate the revenue lost to a low website conversion rate, and see what a 25%, 50%, or 100% improvement in enquiries would be worth at your traffic and close rate.",
  path: "/revenue-leak-calculator",
});

const faqs = [
  {
    question: "How is the revenue estimate calculated?",
    answer:
      "Monthly visitors are multiplied by the enquiry rate to estimate enquiries, then by the close rate to estimate customers, then by the average customer value to estimate revenue. The opportunity figure compares that with the same traffic at a 3% enquiry rate. All figures are arithmetic on the inputs you provide.",
  },
  {
    question: "Why use a 3% enquiry rate as the reference point?",
    answer:
      "It is a stated reference point for a focused B2B service site, not a guarantee or an industry average. It exists so the comparison is transparent. If your rate is already above 3%, the calculator does not invent a loss; it shows what further improvement would be worth instead.",
  },
  {
    question: "Does a higher conversion rate always mean more revenue?",
    answer:
      "No. Conversion gains only become revenue when lead quality and close rate hold. A page that generates more unqualified enquiries can increase sales workload without increasing revenue. The estimate is a prompt for investigation, not a forecast.",
  },
  {
    question: "What usually improves conversion the most?",
    answer:
      "Clearer positioning, specific proof, transparent pricing or expectations, a shorter form, and faster pages. These are usually more valuable than visual redesign. The right order is to fix clarity and trust first, then test smaller changes.",
  },
];

const levers = [
  {
    icon: Gauge,
    title: "Clarity",
    description:
      "Can a first-time visitor tell what you do, who it is for, what it costs, and what happens next? Most conversion gains start here.",
  },
  {
    icon: ShieldCheck,
    title: "Trust",
    description:
      "Specific proof — named results, a real process, transparent commitments — reduces the risk of making contact.",
  },
  {
    icon: TrendingUp,
    title: "Friction",
    description:
      "Fewer fields, faster pages, one obvious action, and a clear response time. Remove anything that makes the next step feel uncertain.",
  },
];

export default function RevenueLeakCalculatorPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          {
            name: "Revenue leak calculator",
            path: "/revenue-leak-calculator",
          },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path: "/revenue-leak-calculator",
          name: "Revenue leak calculator",
          description:
            "Estimate the revenue a website leaves on the table at its current enquiry rate.",
          speakableSelectors: ["h1", "main p:first-of-type"],
        })}
      />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Bitecodes Revenue Leak Calculator",
          description:
            "A transparent calculator for website conversion revenue and improvement scenarios.",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />

      <PageHeader
        eyebrow="Free revenue calculator"
        title={
          <>
            Find the revenue your website is <span>leaking.</span>
          </>
        }
        description="Enter four numbers. See what your current funnel is worth, and what a better enquiry rate would mean at the same traffic and close rate."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          {
            name: "Revenue leak calculator",
            href: "/revenue-leak-calculator",
          },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <RevenueCalculator />
          <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-center text-[13px] leading-[1.6]">
            This is arithmetic on your assumptions, not a forecast or a promise.
            Revenue depends on lead quality, pricing, sales capacity, and the
            market. Use it to decide where to investigate, not as a guarantee.
          </p>
        </div>
      </Section>

      <Section className="bg-surface-2" spacing="sm">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
              Three levers that actually move conversion
            </h2>
            <p className="text-muted-foreground mt-3 text-[16px] leading-[1.6]">
              None of them require a full redesign. Most leaks are clarity and
              friction problems long before they are visual ones.
            </p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {levers.map((lever) => (
              <div
                key={lever.title}
                className="bg-background rounded-[24px] p-7"
              >
                <span className="bg-surface-2 text-primary flex size-11 items-center justify-center rounded-[14px]">
                  <lever.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.01em]">
                  {lever.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                  {lever.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
            Questions about the estimate
          </h2>
          <dl className="mt-8 space-y-6">
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
