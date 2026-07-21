import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calculator, ShieldCheck, Sparkles } from "lucide-react";
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
import { calculatorPages, getCalculatorPage } from "@/data/calculator-pages";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return calculatorPages.map((page) => ({ calculator: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ calculator: string }>;
}): Promise<Metadata> {
  const { calculator } = await params;
  const config = getCalculatorPage(calculator);
  if (!config) notFound();

  return createMetadata({
    title: `${config.title} ${config.accent}`,
    description: config.description,
    path: `/${config.slug}`,
  });
}

export default async function CalculatorPage({
  params,
}: {
  params: Promise<{ calculator: string }>;
}) {
  const { calculator } = await params;
  const config = getCalculatorPage(calculator);
  if (!config) notFound();

  const path = `/${config.slug}`;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: config.title, path },
        ])}
      />
      <JsonLd data={faqSchema(config.faqs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: `${config.title} ${config.accent}`,
          description: config.description,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires JavaScript",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          keywords: config.keywords.join(", "),
        }}
      />
      <PageHeader
        eyebrow={config.eyebrow}
        title={
          <>
            {config.title}{" "}
            <span className="text-gradient">{config.accent}</span>
          </>
        }
        description={config.description}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          { name: config.title, href: path },
        ]}
      />
      <Section spacing="sm">
        <div className="container-page">
          <p className="text-muted-foreground mx-auto max-w-3xl text-center text-base leading-relaxed sm:text-lg">
            {config.intro}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <TrustItem
              icon={Calculator}
              title="Instant range"
              description="See cost and timeline update as scope changes."
            />
            <TrustItem
              icon={ShieldCheck}
              title="Private by default"
              description="No login or contact details are required."
            />
            <TrustItem
              icon={Sparkles}
              title="Delivery-aware"
              description="Includes a complete cross-functional product team."
            />
          </div>
        </div>
      </Section>
      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page">
          <ProjectCostCalculator
            initialInput={config.initialInput}
            lockProjectType
          />
        </div>
      </Section>
      <Section>
        <div className="container-page max-w-3xl">
          <SectionHeader
            eyebrow="Planning guidance"
            title={`Questions about ${config.title.toLowerCase()}`}
            description="Understand what drives the range before requesting a detailed scope."
          />
          <Accordion type="single" collapsible className="mt-10">
            {config.faqs.map((faq, index) => (
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
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
