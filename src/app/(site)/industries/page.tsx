import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { industries } from "@/data/industries";
import { getProject } from "@/data/projects";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Industries",
  description:
    "How Bitecodes approaches software for healthcare, education, recruitment, finance, retail, media, manufacturing, startups, and enterprise teams.",
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
        description="Nine sectors, each with its own workflows and constraints. Every page describes the problems we see and how we approach them. Published case studies appear on the relevant industry page."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Industries", href: "/industries" },
        ]}
      />
      <Section>
        <div className="container-page">
          <StaggerGroup className="grid gap-6 sm:grid-cols-2">
            {industries.map((industry) => {
              const caseNames = (industry.caseStudies ?? [])
                .map((slug) => getProject(slug)?.name)
                .filter(Boolean);
              return (
                <StaggerItem key={industry.slug}>
                  <Link
                    href={`/industries/${industry.slug}`}
                    className="group border-border bg-card hover:border-primary/30 focus-visible:ring-ring flex h-full flex-col rounded-2xl border p-7 shadow-[var(--shadow-soft)] transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
                        <industry.icon className="size-6" />
                      </span>
                      <ArrowUpRight className="text-muted-foreground size-5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </div>
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
                    {caseNames.length > 0 && (
                      <p className="text-muted-foreground mt-5 text-xs">
                        Published work: {caseNames.join(", ")}
                      </p>
                    )}
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </Section>
      <CtaSection
        title="Not sure where your organisation fits?"
        description="Tell us how your team works. We will point you to the most relevant service and describe what a first engagement looks like."
      />
    </>
  );
}
