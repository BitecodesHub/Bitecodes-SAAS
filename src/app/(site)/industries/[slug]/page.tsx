import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { CtaSection } from "@/components/cta-section";
import { Reveal } from "@/components/motion/reveal";
import { ProjectCard } from "@/components/cards/project-card";
import { ServiceCard } from "@/components/cards/service-card";
import { FaqDetails } from "@/components/faq/faq-details";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { industries, getIndustry } from "@/data/industries";
import { getProject } from "@/data/projects";
import { getService } from "@/data/services";
import type { Project, Service } from "@/types/content";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return industries.map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) {
    return createMetadata({ title: "Industry not found", image: false });
  }
  return createMetadata({
    title: `Software for ${industry.name}`,
    description: industry.description,
    path: `/industries/${industry.slug}`,
    image: false,
  });
}

export default async function IndustryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) notFound();

  const services = (industry.relatedServices ?? [])
    .map(getService)
    .filter((service): service is Service => Boolean(service));
  const caseStudies = (industry.caseStudies ?? [])
    .map(getProject)
    .filter((project): project is Project => Boolean(project));
  const faqs = industry.faqs ?? [];

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Industries", path: "/industries" },
          { name: industry.name, path: `/industries/${industry.slug}` },
        ])}
      />
      {faqs.length > 0 && <JsonLd data={faqSchema(faqs)} />}
      <PageHeader
        eyebrow="Industries"
        title={`Software for ${industry.name}`}
        description={industry.description}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Industries", href: "/industries" },
          { name: industry.name, href: `/industries/${industry.slug}` },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-14">
            <Reveal>
              <h2 className="text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
                What we usually find
              </h2>
              <ul className="mt-6 space-y-4">
                {(industry.problems ?? []).map((problem) => (
                  <li
                    key={problem}
                    className="text-muted-foreground flex items-start gap-3 text-[16px] leading-relaxed"
                  >
                    <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                    {problem}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <h2 className="text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
                How we approach it
              </h2>
              <ol className="mt-6 space-y-5">
                {(industry.approach ?? []).map((step, index) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="bg-surface-2 text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground text-[16px] leading-relaxed">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          <div className="space-y-5">
            <div className="bg-surface-2 rounded-[24px] p-6">
              <h2 className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
                Focus areas
              </h2>
              <ul className="mt-4 space-y-3">
                {industry.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-3 text-[15px]"
                  >
                    <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3.5" />
                    </span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] bg-[#1d1d1f] p-6 text-white dark:bg-[#101012]">
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">
                See what your site is missing
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                The free website audit checks one public page for SEO,
                accessibility markup, response performance, and security
                headers.
              </p>
              <Button
                asChild
                className="mt-5 w-full bg-white text-[#1d1d1f] hover:bg-white/90"
              >
                <Link
                  href="/website-audit"
                  data-track="industry-audit-click"
                  data-track-industry={industry.slug}
                  data-track-location="industry-sidebar"
                >
                  Run a free audit
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {caseStudies.length > 0 && (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Published case studies in this sector
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-[17px] leading-relaxed">
              We publish a case study only where the relationship and the work
              allow it. Each one describes the challenge, the approach, and the
              outcome in plain terms.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {caseStudies.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {services.length > 0 && (
        <Section spacing="sm">
          <div className="container-page">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Services that fit this sector
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <ServiceCard
                  key={service.slug}
                  service={service}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      {faqs.length > 0 && (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              {industry.name} questions, answered
            </h2>
            <FaqDetails faqs={faqs} className="mt-8 max-w-3xl" />
          </div>
        </Section>
      )}

      <CtaSection
        title="Start with a free website audit."
        description="See how an existing site performs on SEO, speed, accessibility, and security headers. No account is required, and the report is yours to keep."
        primary={{
          label: "Run a free audit",
          href: "/website-audit",
          track: "industry-audit-click",
        }}
        secondary={{
          label: "Book a call",
          href: "/book-a-call",
          track: "industry-book-call-click",
        }}
      />
    </>
  );
}
