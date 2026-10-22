import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock, Sparkles } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  answerPages,
  getAnswer,
  relatedAnswers,
  type AnswerPage,
} from "@/data/answers";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  speakableSchema,
  webPageSchema,
} from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export function generateStaticParams() {
  return answerPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getAnswer(slug);
  if (!page) return createMetadata({ title: "Answer not found" });
  return createMetadata({
    title: page.question,
    description: page.metaDescription,
    path: `/answers/${page.slug}`,
  });
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function AnswerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getAnswer(slug);
  if (!page) notFound();

  const path = `/answers/${page.slug}`;
  const related = relatedAnswers(page);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Answers", path: "/answers" },
          { name: page.question, path },
        ])}
      />
      <JsonLd
        data={{
          ...webPageSchema({
            path,
            name: page.question,
            description: page.metaDescription,
            dateModified: page.updated,
            speakableSelectors: ["h1", "main p:first-of-type"],
          }),
          speakable: speakableSchema(["h1", "main p:first-of-type"]),
          mainEntity: {
            "@type": "Question",
            name: page.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: page.shortAnswer,
            },
          },
        }}
      />
      <JsonLd data={faqSchema(page.faqs)} />

      <PageHeader
        eyebrow={page.category}
        title={page.question}
        description={page.shortAnswer}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Answers", href: "/answers" },
          { name: page.question, href: path },
        ]}
        align="left"
      />

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-6 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              {page.readingMinutes} min read
            </span>
            <span aria-hidden="true">·</span>
            <span>Reviewed {formatDate(page.updated)}</span>
            <span aria-hidden="true">·</span>
            <span>
              By {siteConfig.name}, a software studio serving{" "}
              {siteConfig.markets.slice(0, 3).join(", ")}, and India
            </span>
          </div>

          <div className="mt-10 space-y-12">
            {page.sections.map((section) => (
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
                  {section.bullets && section.bullets.length > 0 ? (
                    <ul className="mt-5 space-y-2.5">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="text-muted-foreground flex items-start gap-3 text-sm leading-relaxed"
                        >
                          <Check className="text-primary mt-0.5 size-4 shrink-0" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </Reveal>
            ))}
          </div>

          <div className="border-primary/25 bg-primary/5 mt-12 rounded-2xl border p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary size-5" />
              <h2 className="text-lg font-semibold">{page.cta.label}</h2>
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {page.cta.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={page.cta.href} data-track="answer-primary-cta">
                  {page.cta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Ask a specific question</Link>
              </Button>
            </div>
          </div>

          <div className="border-border mt-14 border-t pt-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Frequently asked
            </h2>
            <dl className="mt-6 space-y-6">
              {page.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-medium">{faq.question}</dt>
                  <dd className="text-muted-foreground mt-2 leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-border mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
            <Link
              href="/answers"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
              data-track="answer-back-to-index"
            >
              <ArrowLeft className="size-4" />
              All answers
            </Link>
            <p className="text-muted-foreground text-xs">
              Last reviewed {formatDate(page.updated)}. If this answer is out of
              date, tell us and we will correct it.
            </p>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight">
              Related answers
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {related.map((item) => (
                <RelatedCard key={item.slug} page={item} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}

function RelatedCard({ page }: { page: AnswerPage }) {
  return (
    <Link
      href={`/answers/${page.slug}`}
      className="group border-border bg-card hover:border-primary/30 rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
      data-track="answer-related"
    >
      <Badge variant="secondary">{page.category}</Badge>
      <h3 className="group-hover:text-primary mt-3 leading-snug font-semibold">
        {page.question}
      </h3>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
        {page.shortAnswer}
      </p>
    </Link>
  );
}
