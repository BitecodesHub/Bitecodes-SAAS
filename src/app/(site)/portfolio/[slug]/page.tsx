import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  Flag,
  Layers,
  Lightbulb,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { TechIcon } from "@/components/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { ProjectCover } from "@/components/project-cover";
import { projects, getProject } from "@/data/projects";
import { getTech } from "@/data/technologies";
import { getService } from "@/data/services";
import { industries } from "@/data/industries";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  // `image: false`: this segment has its own opengraph-image.tsx, which
  // createMetadata's generic default would otherwise replace outright.
  if (!project) {
    return createMetadata({ title: "Case study not found", image: false });
  }
  return createMetadata({
    title: `${project.name} — Case Study`,
    description: project.teaser,
    path: `/portfolio/${project.slug}`,
    image: false,
  });
}

function relationshipLabel(
  relationship: "client" | "internal" | "related-party" | undefined,
) {
  switch (relationship) {
    case "internal":
      return "Internal product";
    case "related-party":
      return "Related-party work";
    default:
      return null;
  }
}

function relationshipDisclosure(
  project: (typeof projects)[number],
): string | null {
  if (project.relationship === "internal") {
    return `${project.name} is built and maintained by Bitecodes for its own use. It is shown here as internal work, not as client work.`;
  }
  if (project.relationship === "related-party") {
    return `Bitecodes built this work for ${project.client}, an organisation where the founder also works, and we disclose that relationship here.`;
  }
  return null;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const idx = projects.findIndex((p) => p.slug === slug);
  const next = projects[(idx + 1) % projects.length];
  const stack = project.technologies.map(getTech).filter(Boolean);
  const relatedServices = (project.services ?? []).flatMap((serviceSlug) => {
    const service = getService(serviceSlug);
    return service ? [service] : [];
  });
  const industry = project.industry
    ? industries.find((item) => item.slug === project.industry)
    : undefined;
  const outcomes = project.outcomes ?? [];
  const disclosure = relationshipDisclosure(project);
  const label = relationshipLabel(project.relationship);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Portfolio", path: "/portfolio" },
          { name: project.name, path: `/portfolio/${project.slug}` },
        ])}
      />
      <PageHeader
        eyebrow={project.category}
        title={project.name}
        description={project.overview}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Portfolio", href: "/portfolio" },
          { name: project.name, href: `/portfolio/${project.slug}` },
        ]}
      />

      <div className="container-page -mt-2">
        <Reveal>
          <div className="border-border relative overflow-hidden rounded-3xl border">
            <ProjectCover
              project={project}
              priority
              aspect="aspect-[21/9]"
              sizes="(max-width: 1200px) 100vw, 1100px"
            />
            <div className="absolute bottom-8 left-8 z-30 flex flex-wrap items-center gap-3 text-white">
              <Badge className="border-white/30 bg-white/15 text-white backdrop-blur-sm">
                {project.client}
              </Badge>
              <Badge className="border-white/30 bg-white/15 text-white backdrop-blur-sm">
                {project.year}
              </Badge>
              {label && (
                <Badge className="border-white/30 bg-white/15 text-white backdrop-blur-sm">
                  {label}
                </Badge>
              )}
            </div>
          </div>
        </Reveal>

        <dl className="border-border mt-8 grid gap-6 border-y py-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              Client
            </dt>
            <dd className="mt-1 text-sm font-medium">{project.client}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              Year
            </dt>
            <dd className="mt-1 text-sm font-medium">{project.year}</dd>
          </div>
          {project.engagement && (
            <div>
              <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                Engagement
              </dt>
              <dd className="mt-1 text-sm font-medium">{project.engagement}</dd>
            </div>
          )}
          {industry && (
            <div>
              <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                Industry
              </dt>
              <dd className="mt-1 text-sm font-medium">{industry.name}</dd>
            </div>
          )}
        </dl>

        {disclosure && (
          <div className="border-border bg-surface-2 mt-6 rounded-2xl border p-5 sm:p-6">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              Disclosure
            </p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {disclosure}
            </p>
          </div>
        )}
      </div>

      {/* Challenge + approach */}
      <Section spacing="sm">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <Reveal>
            <div className="border-border bg-card h-full rounded-2xl border p-7 shadow-[var(--shadow-soft)]">
              <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-xl">
                <Target className="size-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold">The challenge</h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                {project.challenge}
              </p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="border-border bg-card h-full rounded-2xl border p-7 shadow-[var(--shadow-soft)]">
              <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                <Lightbulb className="size-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold">Our approach</h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                {project.solution}
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* What we built + outcome */}
      <Section spacing="sm">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
              <Layers className="size-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">What we built</h2>
            <ul className="mt-5 grid gap-3">
              {project.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal direction="left">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
              <Flag className="size-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Outcome</h2>
            {outcomes.length > 0 ? (
              <ul className="mt-5 grid gap-3">
                {outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-3">
                    <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {outcome}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                This case study describes what was built. No outcome figures are
                published without evidence.
              </p>
            )}
          </Reveal>
        </div>
      </Section>

      {/* Technologies + related services */}
      <Section spacing="sm">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <h2 className="text-xl font-semibold">Technologies used</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {stack.map(
                (tech) =>
                  tech && (
                    <span
                      key={tech.slug}
                      className="border-border bg-card flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-sm"
                    >
                      <TechIcon slug={tech.slug} name={tech.name} size="sm" />
                      {tech.name}
                    </span>
                  ),
              )}
            </div>
          </Reveal>

          {relatedServices.length > 0 && (
            <Reveal direction="left">
              <h2 className="text-xl font-semibold">Related services</h2>
              <ul className="border-border mt-5 border-t">
                {relatedServices.map((service) => (
                  <li key={service.slug} className="border-border border-b">
                    <Link
                      href={`/services/${service.slug}`}
                      className="group focus-visible:ring-ring hover:text-primary flex items-center justify-between gap-4 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span>
                        <span className="font-medium">{service.title}</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {service.tagline}
                        </span>
                      </span>
                      <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </Section>

      {/* External client sites open only after an explicit user action. */}
      {project.liveUrl && (
        <Section spacing="sm">
          <div className="container-page">
            <div className="border-primary/20 bg-primary/5 flex flex-col gap-5 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h2 className="text-xl font-semibold">
                  Visit the client website
                </h2>
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                  The link opens on the client&apos;s domain in a new tab. Its
                  content, availability, cookies, and privacy practices are
                  controlled by that site.
                </p>
              </div>
              <Button asChild className="shrink-0">
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  data-track="case-study-live-site"
                >
                  Visit website
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </Section>
      )}

      {/* Conversion CTA for the studio offer. */}
      <Section spacing="sm">
        <div className="container-page">
          <div className="bg-primary text-primary-foreground rounded-3xl px-6 py-14 text-center sm:px-14">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Find out what a free audit would show.
              </h2>
              <p className="text-primary-foreground/85 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
                Run the audit on your own site, or book a 30-minute call to talk
                through the work and what it would take.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  <Link
                    href="/website-audit"
                    data-track="case-study-website-audit"
                  >
                    Run a free website audit
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
                >
                  <Link href="/book-a-call" data-track="case-study-book-call">
                    Book a 30-minute call
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Next project */}
      <Section spacing="sm" className="border-border border-t">
        <div className="container-page flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-muted-foreground text-sm">Next case study</p>
            <p className="text-2xl font-semibold tracking-tight">{next.name}</p>
          </div>
          <Button asChild variant="outline" size="lg">
            <Link href={`/portfolio/${next.slug}`}>
              View {next.name}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
