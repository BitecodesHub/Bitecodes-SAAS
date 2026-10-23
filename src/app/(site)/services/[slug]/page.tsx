import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { CtaSection } from "@/components/cta-section";
import { Reveal } from "@/components/motion/reveal";
import { ProjectCard } from "@/components/cards/project-card";
import { ServiceCard } from "@/components/cards/service-card";
import { FaqDetails } from "@/components/faq/faq-details";
import { TechIcon } from "@/components/tech-icon";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { services, getService } from "@/data/services";
import { industries } from "@/data/industries";
import { projects } from "@/data/projects";
import { getTech } from "@/data/technologies";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  serviceSchema,
} from "@/lib/seo";
import { ServicePricing } from "@/components/pricing/service-pricing";

export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  // `image: false` on both branches: this segment has its own
  // opengraph-image.tsx, which createMetadata's generic default would
  // otherwise replace outright rather than merge with.
  if (!service) {
    return createMetadata({ title: "Service not found", image: false });
  }
  return createMetadata({
    title: service.title,
    description: service.description,
    path: `/services/${service.slug}`,
    image: false,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const related = services
    .filter((s) => s.category === service.category && s.slug !== service.slug)
    .slice(0, 3);
  const stack = service.stack.map(getTech).filter(Boolean);
  const relatedProjects = projects.filter((project) =>
    project.services?.includes(service.slug),
  );
  const relatedIndustries = industries.filter((industry) =>
    industry.relatedServices?.includes(service.slug),
  );
  const faqs = service.faqs ?? [];

  return (
    <>
      <JsonLd data={serviceSchema(service)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />
      {faqs.length > 0 && <JsonLd data={faqSchema(faqs)} />}
      <PageHeader
        eyebrow={service.category}
        title={service.title}
        description={service.tagline}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Services", href: "/services" },
          { name: service.title, href: `/services/${service.slug}` },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-14">
            <Reveal className="space-y-6">
              <span className="bg-surface-2 text-primary flex size-16 items-center justify-center rounded-[22px]">
                <service.icon className="size-8" />
              </span>
              <p className="text-[21px] leading-[1.55] tracking-[-0.012em]">
                {service.description}
              </p>
            </Reveal>

            {service.deliverables && service.deliverables.length > 0 && (
              <Reveal>
                <h2 className="text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
                  What you receive
                </h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {service.deliverables.map((deliverable) => (
                    <li
                      key={deliverable}
                      className="bg-surface-2 flex items-start gap-3 rounded-[18px] p-4 text-[15px] leading-relaxed"
                    >
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span>{deliverable}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            <div className="grid gap-12 sm:grid-cols-2">
              {service.idealFor && service.idealFor.length > 0 && (
                <Reveal>
                  <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
                    Who it is for
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {service.idealFor.map((item) => (
                      <li
                        key={item}
                        className="text-muted-foreground flex items-start gap-3 text-[16px] leading-relaxed"
                      >
                        <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
              {service.outcomes && service.outcomes.length > 0 && (
                <Reveal>
                  <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
                    What changes
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {service.outcomes.map((outcome) => (
                      <li
                        key={outcome}
                        className="text-muted-foreground flex items-start gap-3 text-[16px] leading-relaxed"
                      >
                        <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <ServicePricing slug={service.slug} />
            {service.timeline && (
              <div className="bg-surface-2 rounded-[24px] p-6">
                <h2 className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
                  Typical timeline
                </h2>
                <p className="mt-3 flex items-start gap-3 text-[15px] leading-[1.6]">
                  <Clock3 className="text-primary mt-0.5 size-4 shrink-0" />
                  {service.timeline}
                </p>
                <p className="text-muted-foreground mt-3 text-[13px] leading-[1.6]">
                  The exact schedule is agreed in the written quote before work
                  begins.
                </p>
              </div>
            )}
            {stack.length > 0 && (
              <div className="bg-surface-2 rounded-[24px] p-6">
                <h2 className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
                  Typical stack
                </h2>
                <div className="mt-4 flex flex-col gap-3">
                  {stack.map(
                    (tech) =>
                      tech && (
                        <div
                          key={tech.slug}
                          className="flex items-center gap-3"
                        >
                          <TechIcon
                            slug={tech.slug}
                            name={tech.name}
                            size="sm"
                          />
                          <span className="text-[15px] font-medium">
                            {tech.name}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            )}
            <div className="rounded-[24px] bg-[#1d1d1f] p-6 text-white dark:bg-[#101012]">
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">
                Check the starting point
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                A free website audit shows what is holding an existing site back
                before you commit to a scope.
              </p>
              <Button
                asChild
                className="mt-5 w-full bg-white text-[#1d1d1f] hover:bg-white/90"
              >
                <Link
                  href="/website-audit"
                  data-track="service-audit-click"
                  data-track-service={service.slug}
                  data-track-location="service-sidebar"
                >
                  Run a free audit
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {faqs.length > 0 && (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="max-w-3xl text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Questions about {service.title.toLowerCase()}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-[17px] leading-relaxed">
              Direct answers about scope, timeline, pricing, and how the work is
              delivered.
            </p>
            <FaqDetails faqs={faqs} className="mt-8 max-w-3xl" />
          </div>
        </Section>
      )}

      {relatedProjects.length > 0 && (
        <Section spacing="sm">
          <div className="container-page">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Projects that used this service
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProjects.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {relatedIndustries.length > 0 && (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Where this service fits
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-[17px] leading-relaxed">
              Each industry page describes the workflows, constraints, and
              questions we see in that sector.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedIndustries.map((industry) => (
                <Link
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  className="group bg-background focus-visible:ring-ring flex h-full flex-col rounded-[28px] p-7 transition-shadow hover:shadow-[var(--shadow-lift)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
                    <industry.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">
                    {industry.name}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                    {industry.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section spacing="sm">
          <div className="container-page">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Related services
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <ServiceCard key={s.slug} service={s} className="h-full" />
              ))}
            </div>
          </div>
        </Section>
      )}

      <CtaSection
        title="Start with a free website audit."
        description="See how an existing site performs on SEO, speed, accessibility, and security headers. No account is required, and the report is yours to keep."
        primary={{
          label: "Run a free audit",
          href: "/website-audit",
          track: "service-audit-click",
        }}
        secondary={{
          label: "Book a call",
          href: "/book-a-call",
          track: "service-book-call-click",
        }}
      />
    </>
  );
}
