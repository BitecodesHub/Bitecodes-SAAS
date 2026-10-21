import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
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
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-12">
            <Reveal className="space-y-5">
              <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
                <service.icon className="size-7" />
              </span>
              <p className="text-lg leading-relaxed">{service.description}</p>
              {service.timeline && (
                <p className="text-muted-foreground leading-relaxed">
                  {service.timeline} The exact schedule is agreed in the written
                  quote before work begins.
                </p>
              )}
            </Reveal>

            {service.deliverables && service.deliverables.length > 0 && (
              <Reveal>
                <h2 className="text-2xl font-semibold tracking-tight">
                  What you receive
                </h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {service.deliverables.map((deliverable) => (
                    <li key={deliverable} className="flex items-start gap-3">
                      <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                        <Check className="size-3.5" />
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {deliverable}
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            <div className="grid gap-10 sm:grid-cols-2">
              {service.idealFor && service.idealFor.length > 0 && (
                <Reveal>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Who it is for
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {service.idealFor.map((item) => (
                      <li
                        key={item}
                        className="text-muted-foreground flex items-start gap-3 text-sm leading-relaxed"
                      >
                        <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
              {service.outcomes && service.outcomes.length > 0 && (
                <Reveal>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    What changes
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {service.outcomes.map((outcome) => (
                      <li
                        key={outcome}
                        className="text-muted-foreground flex items-start gap-3 text-sm leading-relaxed"
                      >
                        <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {service.timeline && (
              <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                  Typical timeline
                </h2>
                <p className="mt-3 flex items-start gap-3 text-sm leading-relaxed">
                  <Clock3 className="text-primary mt-0.5 size-4 shrink-0" />
                  {service.timeline}
                </p>
              </div>
            )}
            {stack.length > 0 && (
              <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
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
                          <span className="text-sm font-medium">
                            {tech.name}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            )}
            <ServicePricing slug={service.slug} />
            <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold">
                Check the starting point
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                A free website audit shows what is holding an existing site back
                before you commit to a scope.
              </p>
              <Button asChild className="mt-4 w-full">
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
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <SectionHeader
              eyebrow="FAQ"
              title={`Questions about ${service.title.toLowerCase()}`}
              description="Direct answers about scope, timeline, pricing, and how the work is delivered."
              align="left"
            />
            <FaqDetails faqs={faqs} className="mt-8 max-w-3xl" />
          </div>
        </Section>
      )}

      {relatedProjects.length > 0 && (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <SectionHeader
              eyebrow="Related work"
              title="Projects that used this service"
              align="left"
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProjects.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {relatedIndustries.length > 0 && (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <SectionHeader
              eyebrow="Industries"
              title="Where this service fits"
              description="Each industry page describes the workflows, constraints, and questions we see in that sector."
              align="left"
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedIndustries.map((industry) => (
                <Link
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  className="group border-border bg-card hover:border-primary/30 focus-visible:ring-ring flex h-full flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                    <industry.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">
                    {industry.name}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {industry.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight">
              Related services
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <ServiceCard key={s.slug} service={s} className="h-full" />
              ))}
            </div>
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
                    data-track="service-audit-click"
                    data-track-service={service.slug}
                    data-track-location="service-footer"
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
                    data-track="service-book-call-click"
                    data-track-service={service.slug}
                    data-track-location="service-footer"
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
