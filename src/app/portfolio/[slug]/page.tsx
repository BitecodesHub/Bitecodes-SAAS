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
import { cn } from "@/lib/utils";

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
  if (!project) return createMetadata({ title: "Case study not found" });
  return createMetadata({
    title: `${project.name} — Case Study`,
    description: project.teaser,
    path: `/portfolio/${project.slug}`,
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
          <div
            className={cn(
              "border-border relative flex aspect-[21/9] items-end overflow-hidden rounded-3xl border bg-gradient-to-br p-8",
              project.accent,
            )}
          >
            <div className="bg-grid absolute inset-0 opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div className="relative flex flex-wrap items-center gap-3 text-white">
              <Badge className="border-white/30 bg-white/15 text-white">
                {project.client}
              </Badge>
              <Badge className="border-white/30 bg-white/15 text-white">
                {project.year}
              </Badge>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Results metrics */}
      <Section spacing="sm">
        <div className="container-page grid gap-6 sm:grid-cols-3">
          {project.results.map((r) => (
            <Reveal key={r.label}>
              <div className="border-border bg-card rounded-2xl border p-6 text-center shadow-[var(--shadow-soft)]">
                <p className="text-gradient text-3xl font-semibold tracking-tight">
                  {r.metric}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">{r.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

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

      {/* Live preview */}
      {project.liveUrl && (
        <Section spacing="sm">
          <div className="container-page">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Live website</h2>
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              >
                Open in new tab
                <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="border-border mt-5 overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)]">
              <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-400" />
                  <span className="size-2.5 rounded-full bg-yellow-400" />
                  <span className="size-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-muted-foreground ml-2 truncate text-xs">
                  {project.liveUrl}
                </span>
              </div>
              <iframe
                src={project.liveUrl}
                className="h-[600px] w-full"
                title={`Live preview of ${project.liveUrl}`}
                loading="lazy"
              />
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
