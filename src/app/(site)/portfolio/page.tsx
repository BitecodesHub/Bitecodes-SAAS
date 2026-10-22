import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { projects } from "@/data/projects";
import { industries } from "@/data/industries";
import { services } from "@/data/services";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { PortfolioExplorer } from "./portfolio-explorer";

export const metadata: Metadata = createMetadata({
  title: "Portfolio",
  description:
    "Case studies across AI, healthcare, media, recruitment, and enterprise software. Each entry describes the problem, the approach, and what was built.",
  path: "/portfolio",
});

export default function PortfolioPage() {
  // Options are derived from the published projects, so no filter can lead to
  // an empty category. Internal work remains visible but is labelled as such.
  const industryOptions = industries
    .filter((industry) =>
      projects.some((project) => project.industry === industry.slug),
    )
    .map(({ slug, name }) => ({ slug, name }));

  const serviceOptions = services
    .filter((service) =>
      projects.some((project) => project.services?.includes(service.slug)),
    )
    .map(({ slug, title }) => ({ slug, name: title }));

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
        title="Work we are proud to put our name on"
        description="Case studies spanning AI platforms, care operations, media, and recruitment. Every entry states the problem, the approach, and what was built. Internal and related-party work is labelled."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Portfolio", href: "/portfolio" },
        ]}
      />
      <Section>
        <div className="container-page">
          <PortfolioExplorer
            projects={projects}
            industryOptions={industryOptions}
            serviceOptions={serviceOptions}
          />
        </div>
      </Section>
      <CtaSection
        title="Your project could be next."
        description="Tell us what you are building. We will show you how we would approach it."
      />
    </>
  );
}
