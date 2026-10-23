import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calculator, PackageCheck, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { ProjectCostCalculator } from "@/components/calculators/project-cost-calculator";
import { FaqDetails } from "@/components/faq/faq-details";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
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
            {config.title} <span>{config.accent}</span>
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
          <p className="text-muted-foreground mx-auto max-w-3xl text-center text-[17px] leading-[1.6]">
            {config.intro}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
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
              icon={PackageCheck}
              title="Delivery-aware"
              description="Includes a complete cross-functional product team."
            />
          </div>
        </div>
      </Section>
      <Section className="bg-surface-2" spacing="sm">
        <div className="container-page">
          <ProjectCostCalculator
            initialInput={config.initialInput}
            lockProjectType
          />
        </div>
      </Section>
      <Section>
        <div className="container-page max-w-3xl">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            Questions about {config.title.toLowerCase()}
          </h2>
          <p className="text-muted-foreground mt-3 text-[16px] leading-[1.6]">
            Understand what drives the range before requesting a detailed scope.
          </p>
          <FaqDetails faqs={config.faqs} className="mt-8" />
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
    <div className="bg-surface-2 flex gap-4 rounded-[24px] p-6">
      <span className="bg-background text-primary flex size-11 shrink-0 items-center justify-center rounded-[14px]">
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
          {title}
        </h3>
        <p className="text-muted-foreground mt-1.5 text-[14px] leading-[1.55]">
          {description}
        </p>
      </div>
    </div>
  );
}
