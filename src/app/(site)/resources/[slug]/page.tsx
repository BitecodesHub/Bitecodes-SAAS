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
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
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
                className="text-[19px] leading-[1.65] tracking-[-0.005em] text-pretty"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-14 space-y-14">
            {resource.sections.map((section) => (
              <Reveal key={section.heading}>
                <section>
                  <h2 className="text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance">
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-muted-foreground text-[17px] leading-[1.65]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {section.steps && section.steps.length > 0 ? (
                    <ol className="mt-6 space-y-3">
                      {section.steps.map((step, stepIndex) => (
                        <li
                          key={step.title}
                          className="bg-surface-2 rounded-[20px] p-5"
                        >
                          <p className="text-[16px] font-semibold">
                            <span className="text-muted-foreground mr-2 tabular-nums">
                              {String(stepIndex + 1).padStart(2, "0")}
                            </span>
                            {step.title}
                          </p>
                          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.6]">
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
                          className="text-muted-foreground flex items-start gap-3 text-[16px] leading-[1.6]"
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
            <div id="checklist" className="mt-16 scroll-mt-24">
              <ResourceChecklistForm
                slug={resource.slug}
                resourceTitle={resource.title}
                checklistTitle={resource.checklist.title}
                itemCount={resource.checklist.items.length}
              />
            </div>
          ) : null}

          {resource.faqs && resource.faqs.length > 0 ? (
            <div className="bg-surface-2 mt-16 rounded-[28px] p-7 sm:p-9">
              <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
                Frequently asked
              </h2>
              <dl className="mt-6 space-y-6">
                {resource.faqs.map((faq) => (
                  <div key={faq.question}>
                    <dt className="text-[16px] font-semibold">
                      {faq.question}
                    </dt>
                    <dd className="text-muted-foreground mt-2 text-[15px] leading-[1.6]">
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/resources"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-[15px] font-medium hover:underline"
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

          <p className="text-muted-foreground mt-8 text-[13px] leading-[1.6]">
            Written and maintained by {siteConfig.name}. If something here is
            wrong or out of date, tell us and we will correct it.
          </p>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
              Related guides
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/resources/${item.slug}`}
                  className="group bg-background rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
                  data-track="resource-related"
                >
                  <Badge variant="secondary">{item.category}</Badge>
                  <h3 className="group-hover:text-primary mt-4 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
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
