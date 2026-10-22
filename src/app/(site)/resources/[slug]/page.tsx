import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResourceChecklistForm } from "@/components/resources/resource-checklist-form";
import { getResource, relatedResources, resources } from "@/data/resources";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export function generateStaticParams() {
  return resources.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) {
    return createMetadata({ title: "Guide not found" });
  }
  return createMetadata({
    title: resource.title,
    description: resource.metaDescription,
    path: `/resources/${resource.slug}`,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) notFound();

  const related = relatedResources(resource);
  const path = `/resources/${resource.slug}`;

  const guideSchema =
    resource.format === "HowTo" && resource.howToSteps?.length
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: resource.title,
          description: resource.metaDescription,
          datePublished: resource.published,
          dateModified: resource.updated,
          author: {
            "@type": "Organization",
            name: siteConfig.name,
            url: siteConfig.url,
          },
          step: resource.howToSteps.map((step, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: step.name,
            text: step.text,
          })),
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: resource.title,
          description: resource.metaDescription,
          datePublished: resource.published,
          dateModified: resource.updated,
          author: {
            "@type": "Organization",
            name: siteConfig.name,
            url: siteConfig.url,
          },
          publisher: {
            "@type": "Organization",
            name: siteConfig.name,
            logo: {
              "@type": "ImageObject",
              url: `${siteConfig.url}/icon.svg`,
            },
          },
          mainEntityOfPage: `${siteConfig.url}${path}`,
        };

  return (
    <>
      <JsonLd data={guideSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
          { name: resource.title, path },
        ])}
      />
      {resource.faqs && resource.faqs.length > 0 ? (
        <JsonLd data={faqSchema(resource.faqs)} />
      ) : null}

      <PageHeader
        eyebrow={resource.category}
        title={resource.title}
        description={resource.description}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Resources", href: "/resources" },
          { name: resource.title, href: path },
        ]}
        align="left"
      />

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-6 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              {resource.readingMinutes} min read
            </span>
            <span aria-hidden="true">·</span>
            <span>Published {formatDate(resource.published)}</span>
            {resource.updated !== resource.published ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {formatDate(resource.updated)}</span>
              </>
            ) : null}
            {resource.checklist ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href="#checklist"
                  className="text-primary inline-flex min-h-11 items-center gap-1.5 hover:underline"
                >
                  <Download className="size-4" />
                  Printable checklist
                </a>
              </>
            ) : null}
          </div>

          <div className="mt-8 space-y-5">
            {resource.intro.map((paragraph) => (
              <p
                key={paragraph}
                className="text-muted-foreground text-base leading-relaxed sm:text-lg"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-12 space-y-12">
            {resource.sections.map((section) => (
              <Reveal key={section.heading}>
                <section>
                  <h2 className="text-2xl font-semibold tracking-tight text-balance">
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-muted-foreground leading-relaxed"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {section.steps && section.steps.length > 0 ? (
                    <ol className="mt-6 space-y-4">
                      {section.steps.map((step, stepIndex) => (
                        <li
                          key={step.title}
                          className="border-border bg-card rounded-2xl border p-5"
                        >
                          <p className="font-medium">
                            <span className="text-muted-foreground mr-2 tabular-nums">
                              {String(stepIndex + 1).padStart(2, "0")}
                            </span>
                            {step.title}
                          </p>
                          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                            {step.text}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {section.bullets && section.bullets.length > 0 ? (
                    <ul className="mt-5 space-y-2.5">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="text-muted-foreground flex items-start gap-3 text-sm leading-relaxed"
                        >
                          <span
                            aria-hidden="true"
                            className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </Reveal>
            ))}
          </div>

          {resource.checklist ? (
            <div id="checklist" className="mt-14 scroll-mt-24">
              <ResourceChecklistForm
                slug={resource.slug}
                resourceTitle={resource.title}
                checklistTitle={resource.checklist.title}
                itemCount={resource.checklist.items.length}
              />
            </div>
          ) : null}

          {resource.faqs && resource.faqs.length > 0 ? (
            <div className="border-border mt-14 border-t pt-10">
              <h2 className="text-2xl font-semibold tracking-tight">
                Frequently asked
              </h2>
              <dl className="mt-6 space-y-6">
                {resource.faqs.map((faq) => (
                  <div key={faq.question}>
                    <dt className="font-medium">{faq.question}</dt>
                    <dd className="text-muted-foreground mt-2 leading-relaxed">
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="border-border mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
            <Link
              href="/resources"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
              data-track="resource-back-to-index"
            >
              <ArrowLeft className="size-4" />
              All guides
            </Link>
            <Button asChild variant="secondary">
              <Link href="/contact" data-track="resource-contact-cta">
                Ask a question about this guide
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
            Written and maintained by {siteConfig.name}. If something here is
            wrong or out of date, tell us and we will correct it.
          </p>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight">
              Related guides
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/resources/${item.slug}`}
                  className="group border-border bg-card hover:border-primary/30 rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
                  data-track="resource-related"
                >
                  <Badge variant="secondary">{item.category}</Badge>
                  <h3 className="group-hover:text-primary mt-3 leading-snug font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
