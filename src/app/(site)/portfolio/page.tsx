import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { ProjectCard } from "@/components/cards/project-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { projects } from "@/data/projects";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Portfolio",
  description:
    "Premium case studies across AI, healthcare, media, recruitment, and enterprise — see how Bitecodes turns hard problems into shipped software.",
  path: "/portfolio",
});

export default function PortfolioPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Portfolio", path: "/portfolio" },
        ])}
      />
      <PageHeader
        eyebrow="Portfolio"
        title="Work we're proud to put our name on"
        description="Ten case studies spanning AI platforms, care operations, media, and recruitment. Each one shipped, supported, and built to last."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Portfolio", href: "/portfolio" },
        ]}
      />
      <Section>
        <div className="container-page">
          <StaggerGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => (
              <StaggerItem key={project.slug}>
                <ProjectCard
                  project={project}
                  priority={i < 3}
                  className="h-full"
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </Section>
      <CtaSection
        title="Your project could be next."
        description="Tell us what you're building. We'll show you how we'd approach it."
      />
    </>
  );
}
