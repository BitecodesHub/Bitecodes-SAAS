import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ServiceCard } from "@/components/cards/service-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { Section } from "@/components/section";
import { services, serviceCategories } from "@/data/services";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Services",
  description:
    "From websites and web apps to enterprise software, SaaS, APIs, cloud, and AI integration — explore the full range of what Bitecodes builds.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ])}
      />
      <PageHeader
        eyebrow="Services"
        title="Everything you need to design, build, and scale"
        description="Nineteen focused services, one accountable team. Pick a single engagement or partner with us across the entire software lifecycle."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Services", href: "/services" },
        ]}
      />
      <Section>
        <div className="container-page space-y-16">
          {serviceCategories.map((category) => {
            const items = services.filter((s) => s.category === category);
            return (
              <div key={category}>
                <div className="mb-6 flex items-center gap-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {category}
                  </h2>
                  <span className="bg-border h-px flex-1" />
                  <span className="text-muted-foreground text-sm">
                    {items.length} services
                  </span>
                </div>
                <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((service) => (
                    <StaggerItem key={service.slug}>
                      <ServiceCard service={service} className="h-full" />
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </div>
            );
          })}
        </div>
      </Section>
      <CtaSection
        title="Not sure which service you need?"
        description="Tell us the problem and we'll recommend the right approach — no jargon, no pressure."
      />
    </>
  );
}
