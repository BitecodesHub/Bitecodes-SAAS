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
                    className="group bg-surface-2 hover:bg-background focus-visible:ring-ring flex h-full flex-col rounded-[28px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-lift)] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="bg-background text-primary flex size-12 items-center justify-center rounded-2xl shadow-[var(--shadow-soft)]">
                        <industry.icon className="size-6" />
                      </span>
                      <ArrowUpRight className="text-muted-foreground size-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">
                      {industry.name}
                    </h2>
                    <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                      {industry.description}
                    </p>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {industry.highlights.map((h) => (
                        <li
                          key={h}
                          className="bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium"
                        >
                          <Check className="text-primary size-3" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    {caseNames.length > 0 && (
                      <p className="text-muted-foreground mt-auto pt-5 text-[13px]">
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
