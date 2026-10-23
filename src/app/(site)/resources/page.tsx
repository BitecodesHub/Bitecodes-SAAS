import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckSquare, Clock, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/json-ld";
import { Badge } from "@/components/ui/badge";
import { resources } from "@/data/resources";
import { breadcrumbSchema, createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Resources",
  description:
    "Practical, free guides for business owners and clinic managers: launching a website, hiring a software studio, preparing an AI assistant, speed, and budgets.",
  path: "/resources",
});

export default function ResourcesPage() {
  const categories = Array.from(
    new Set(resources.map((resource) => resource.category)),
  );

  const listSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Bitecodes resources",
    description:
      "Practical guides for business owners and clinic managers, with printable checklists.",
    url: `${siteConfig.url}/resources`,
    hasPart: resources.map((resource) => ({
      "@type": resource.format === "HowTo" ? "HowTo" : "Article",
      name: resource.title,
      description: resource.metaDescription,
      url: `${siteConfig.url}/resources/${resource.slug}`,
    })),
  };

  return (
    <>
      <JsonLd data={listSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
        ])}
      />

      <PageHeader
        eyebrow="Resources"
        title="Practical guides, free to read"
        description="Everything here is written to be used, not skimmed. Read the full guide without an email address; ask for the printable checklist if it will help in a meeting."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Resources", href: "/resources" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="bg-surface-2 mx-auto max-w-3xl rounded-[28px] p-7 sm:p-9">
            <h2 className="text-[21px] leading-tight font-semibold tracking-[-0.02em]">
              How these guides work
            </h2>
            <p className="text-muted-foreground mt-3 text-[16px] leading-[1.6]">
              Each guide answers a question we hear from business owners and
              practice managers. There is no paywall and no email required to
              read one. Where a checklist is useful away from a screen, an
              optional printable version is available at the end.
            </p>
            <p className="text-muted-foreground mt-3 text-[16px] leading-[1.6]">
              Written and maintained by {siteConfig.name}. If a price, rule, or
              recommendation changes, the guide is updated rather than left to
              drift.
            </p>
          </div>

          <div className="mt-16 space-y-16">
            {categories.map((category) => {
              const items = resources.filter(
                (resource) => resource.category === category,
              );
              return (
                <section key={category}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
                      {category}
                    </h2>
                    <span className="text-muted-foreground text-[13px] tabular-nums">
                      {items.length} {items.length === 1 ? "guide" : "guides"}
                    </span>
                  </div>
                  <div className="mt-8 grid gap-3 md:grid-cols-2">
                    {items.map((resource) => (
                      <Reveal key={resource.slug}>
                        <Link
                          href={`/resources/${resource.slug}`}
                          className="group bg-surface-2 hover:bg-background flex h-full flex-col rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
                          data-track="resource-card"
                          data-track-source={`resources-index/${resource.slug}`}
                        >
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Badge variant="secondary">
                              {resource.format === "HowTo" ? (
                                <CheckSquare className="size-3.5" />
                              ) : (
                                <FileText className="size-3.5" />
                              )}
                              {resource.format}
                            </Badge>
                            <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
                              <Clock className="size-3.5" />
                              {resource.readingMinutes} min read
                            </span>
                          </div>
                          <h3 className="group-hover:text-primary mt-4 text-[21px] leading-[1.25] font-semibold tracking-[-0.015em] text-balance transition-colors">
                            {resource.title}
                          </h3>
                          <p className="text-muted-foreground mt-2.5 flex-1 text-[15px] leading-[1.55]">
                            {resource.description}
                          </p>
                          <span className="text-primary mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium">
                            Read the guide
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      </Reveal>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="bg-surface-2 mt-16 flex flex-col gap-5 rounded-[28px] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <p className="text-[19px] font-semibold tracking-[-0.01em]">
                Need an answer that is not here?
              </p>
              <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.5]">
                Ask directly. We answer with a recommendation, not a sales
                sequence.
              </p>
            </div>
            <Link
              href="/contact"
              className="bg-background hover:bg-secondary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-colors"
              data-track="resources-contact"
            >
              Ask a question
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
