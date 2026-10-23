import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { ProjectCard } from "@/components/cards/project-card";
import { Reveal } from "@/components/motion/reveal";
import { featuredProjects } from "@/data/projects";

export function FeaturedWorkSection() {
  const [lead, ...rest] = featuredProjects;

  return (
    <Section id="work">
      <div className="container-page">
        <SectionHeader
          eyebrow="Selected work"
          title="Case studies in shipping the hard part."
          description="Real clients, real deployments, and an honest account of the problem, the approach, and what was built."
        />

        {lead ? (
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <Reveal className="md:col-span-2">
              <ProjectCard
                project={lead}
                priority
                lead
                coverAspect="aspect-[16/10] sm:aspect-[21/9]"
              />
            </Reveal>
            {rest.map((project) => (
              <Reveal key={project.slug}>
                <ProjectCard project={project} className="h-full" />
              </Reveal>
            ))}
          </div>
        ) : null}

        <div className="mt-10 flex justify-center">
          <Link
            href="/portfolio"
            className="text-primary inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium transition-opacity hover:opacity-75"
          >
            All case studies
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}
