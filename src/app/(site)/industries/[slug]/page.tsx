import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
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
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-12">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight">
                What we usually find
              </h2>
              <ul className="mt-5 space-y-4">
                {(industry.problems ?? []).map((problem) => (
                  <li
                    key={problem}
                    className="text-muted-foreground flex items-start gap-3 leading-relaxed"
                  >
                    <span className="border-border bg-card mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border">
                      <span className="bg-primary size-1.5 rounded-full" />
                    </span>
                    {problem}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight">
                How we approach it
              </h2>
              <ol className="mt-5 space-y-5">
                {(industry.approach ?? []).map((step, index) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="text-muted-foreground mt-0.5 text-sm font-semibold tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          <div className="space-y-6">
            <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Focus areas
              </h2>
              <ul className="mt-4 space-y-3">
                {industry.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3.5" />
                    </span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold">
                See what your site is missing
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                The free website audit checks one public page for SEO,
                accessibility markup, response performance, and security
                headers.
              </p>
              <Button asChild className="mt-4 w-full">
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
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <SectionHeader
              eyebrow="Related work"
              title="Published case studies in this sector"
              description="We publish a case study only where the relationship and the work allow it. Each one describes the challenge, the approach, and the outcome in plain terms."
              align="left"
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {caseStudies.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {services.length > 0 && (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <SectionHeader
              eyebrow="Services"
              title="Services that fit this sector"
              align="left"
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <SectionHeader
              eyebrow="FAQ"
              title={`${industry.name} questions, answered`}
              align="left"
            />
            <FaqDetails faqs={faqs} className="mt-8 max-w-3xl" />
          </div>
        </Section>
      )}

      <Section spacing="sm" className="border-border border-t">
        <div className="container-page">
          <Reveal>
            <div className="bg-primary text-primary-foreground rounded-3xl px-6 py-12 text-center sm:px-14 sm:py-16">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Start with a free website audit.
              </h2>
              <p className="text-primary-foreground/85 mx-auto mt-4 max-w-2xl text-base leading-relaxed">
                See how an existing site performs on SEO, speed, accessibility,
                and security headers. No account is required, and the report is
                yours to keep.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  <Link
                    href="/website-audit"
                    data-track="industry-audit-click"
                    data-track-industry={industry.slug}
                    data-track-location="industry-footer"
                  >
                    Run a free audit
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
                >
                  <Link
                    href="/book-a-call"
                    data-track="industry-book-call-click"
                    data-track-industry={industry.slug}
                    data-track-location="industry-footer"
                  >
                    Book a call
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
