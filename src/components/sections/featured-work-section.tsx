import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/section";
import { ProjectCard } from "@/components/cards/project-card";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { featuredProjects } from "@/data/projects";

export function FeaturedWorkSection() {
  const [lead, ...rest] = featuredProjects;

  return (
    <Section id="work">
      <div className="container-page">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal className="max-w-2xl">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              Selected work
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl md:leading-[1.08]">
              Case studies in shipping the hard part.
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              A selection of client projects we have designed, built, and
              shipped.
            </p>
          </Reveal>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/portfolio">
              All case studies
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {lead ? (
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <ProjectCard
              project={lead}
              priority
              lead
              coverAspect="aspect-[16/10] sm:aspect-[21/9]"
              className="md:col-span-2"
            />
            {rest.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
