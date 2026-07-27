import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { industries } from "@/data/industries";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Industries",
  description:
    "Bitecodes builds software across healthcare, education, recruitment, finance, retail, media, manufacturing, startups, and enterprise.",
  path: "/industries",
});

export default function IndustriesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Industries", path: "/industries" },
        ])}
      />
      <PageHeader
        eyebrow="Industries"
        title="Software shaped to your domain"
        description="We have shipped across these sectors, so we understand the constraints, the jargon, and the stakes before the first meeting ends."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Industries", href: "/industries" },
        ]}
      />
      <Section>
        <div className="container-page">
          <StaggerGroup className="grid gap-6 sm:grid-cols-2">
            {industries.map((industry) => (
              <StaggerItem key={industry.slug}>
                <div className="border-border bg-card hover:border-primary/30 flex h-full flex-col rounded-2xl border p-7 shadow-[var(--shadow-soft)] transition-colors">
                  <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
                    <industry.icon className="size-6" />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold">
                    {industry.name}
                  </h2>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {industry.description}
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {industry.highlights.map((h) => (
                      <li
                        key={h}
                        className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                      >
                        <Check className="text-primary size-3" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </Section>
      <CtaSection />
    </>
  );
}
