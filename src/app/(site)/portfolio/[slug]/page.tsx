import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Target, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { TechIcon } from "@/components/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { projects, getProject } from "@/data/projects";
import { getTech } from "@/data/technologies";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { ProjectCover } from "@/components/project-cover";

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

      {/* Cover */}
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
            </div>
          </div>
        </Reveal>
      </div>

      {/* Case-study facts remain descriptive until client-approved quantitative
          results and their measurement methodology are available. */}

      {/* Challenge + Solution */}
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
              <h2 className="mt-4 text-xl font-semibold">Our solution</h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                {project.solution}
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Features + Tech */}
      <Section spacing="sm">
        <div className="container-page grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <h2 className="text-xl font-semibold">Key features</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
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
        </div>
      </Section>

      {/* External client sites open only after an explicit user action. Avoiding
          iframes prevents third-party code, cookies, and tracking on this page. */}
      {project.liveUrl && (
        <Section spacing="sm">
          <div className="container-page">
            <div className="border-primary/20 bg-primary/5 flex flex-col gap-5 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h2 className="text-xl font-semibold">
                  Explore the live website
                </h2>
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                  The project opens on the client&apos;s domain in a new tab.
                  Its content, availability, cookies, and privacy practices are
                  controlled by that site.
                </p>
              </div>
              <Button asChild className="shrink-0">
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  Visit live project
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </Section>
      )}

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

      <CtaSection />
    </>
  );
}
