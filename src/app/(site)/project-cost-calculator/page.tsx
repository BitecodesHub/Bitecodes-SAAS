import type { Metadata } from "next";
import { Calculator, PackageCheck, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { ProjectCostCalculator } from "@/components/calculators/project-cost-calculator";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Software Development Cost Calculator India",
  description:
    "Estimate the cost, delivery timeline, and team size for a website, mobile app, SaaS MVP, custom platform, enterprise system, or AI automation project in India.",
  path: "/project-cost-calculator",
});

const calculatorFaqs = [
  {
    question: "How accurate is this software development cost estimate?",
    answer:
      "It is a directional planning range based on project type, complexity, platforms, features, delivery urgency, and support. A final fixed quote requires a short discovery process to confirm workflows, integrations, data, security, and acceptance criteria.",
  },
  {
    question: "Does the estimate include GST and cloud charges?",
    answer:
      "No. GST, cloud usage, paid APIs, software licences, app-store fees, content production, and other third-party charges are excluded unless a proposal explicitly includes them.",
  },
  {
    question: "Can Bitecodes work with an existing product or design?",
    answer:
      "Yes. We can extend an existing application, modernize a legacy platform, use an established design system, or begin with product discovery and a new user experience.",
  },
  {
    question: "Why does priority delivery cost more?",
    answer:
      "Accelerated delivery can require parallel workstreams, more senior oversight, faster review cycles, and reserved team capacity. We only recommend it when the scope and decision-making process support it.",
  },
];

export default function ProjectCostCalculatorPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Project cost calculator", path: "/project-cost-calculator" },
        ])}
      />
      <JsonLd data={faqSchema(calculatorFaqs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Bitecodes Software Development Cost Calculator",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires JavaScript",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }}
      />
      <PageHeader
        eyebrow="Free planning tool"
        title={
          <>
            Software development cost calculator <span>for India</span>
          </>
        }
        description="Configure your project and get an immediate, realistic investment range, delivery window, and suggested team. No account or email required."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Cost calculator", href: "/project-cost-calculator" },
        ]}
      />
      <Section spacing="sm">
        <div className="container-page grid gap-4 sm:grid-cols-3">
          <TrustItem
            icon={Calculator}
            title="Transparent assumptions"
            description="See exactly which choices affect the range."
          />
          <TrustItem
            icon={ShieldCheck}
            title="No sign-up wall"
            description="Explore privately before sharing your brief."
          />
          <TrustItem
            icon={PackageCheck}
            title="Built for real delivery"
            description="Includes design, engineering, QA, and launch."
          />
        </div>
      </Section>
      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page">
          <ProjectCostCalculator />
        </div>
      </Section>
      <Section>
        <div className="container-page max-w-3xl">
          <SectionHeader
            eyebrow="Questions"
            title="What the estimate means"
            description="Clear boundaries make an early estimate useful rather than misleading."
          />
          <Accordion type="single" collapsible className="mt-10">
            {calculatorFaqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`faq-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>
    </>
  );
}

function TrustItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Calculator;
  title: string;
  description: string;
}) {
  return (
    <div className="border-border bg-card flex gap-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
