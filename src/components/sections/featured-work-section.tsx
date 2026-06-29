import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { ProjectCard } from "@/components/cards/project-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { featuredProjects } from "@/data/projects";

export function FeaturedWorkSection() {
  return (
    <Section id="work">
      <div className="container-page">
        <SectionHeader
          eyebrow="Selected work"
          title="Case studies in shipping the hard part"
          description="A few of the products we have designed, built, and scaled with our clients."
        />
        <StaggerGroup className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredProjects.map((project, i) => (
            <StaggerItem key={project.slug}>
              <ProjectCard
                project={project}
                priority={i === 0}
                className="h-full"
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/portfolio">
              See the full portfolio
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
