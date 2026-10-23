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
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
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

          <div className="mt-12 space-y-14">
            {page.sections.map((section) => (
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
                  {section.bullets && section.bullets.length > 0 ? (
                    <ul className="mt-5 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="text-muted-foreground flex items-start gap-3 text-[16px] leading-[1.6]"
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

          <div className="bg-surface-2 mt-16 rounded-[28px] p-7 sm:p-9">
            <div className="flex items-center gap-2.5">
              <Sparkles className="text-primary size-5" />
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">
                {page.cta.label}
              </h2>
            </div>
            <p className="text-muted-foreground mt-2.5 text-[16px] leading-[1.6]">
              {page.cta.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={page.cta.href} data-track="answer-primary-cta">
                  {page.cta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="bg-background">
                <Link href="/contact">Ask a specific question</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
              Frequently asked
            </h2>
            <dl className="mt-7 space-y-6">
              {page.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-[16px] font-semibold">{faq.question}</dt>
                  <dd className="text-muted-foreground mt-2 text-[16px] leading-[1.65]">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/answers"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-[15px] font-medium hover:underline"
              data-track="answer-back-to-index"
            >
              <ArrowLeft className="size-4" />
              All answers
            </Link>
            <p className="text-muted-foreground text-[13px]">
              Last reviewed {formatDate(page.updated)}. If this answer is out of
              date, tell us and we will correct it.
            </p>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
              Related answers
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
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
      className="group bg-background rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
      data-track="answer-related"
    >
      <Badge variant="secondary">{page.category}</Badge>
      <h3 className="group-hover:text-primary mt-4 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] transition-colors">
        {page.question}
      </h3>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-[15px] leading-[1.55]">
        {page.shortAnswer}
      </p>
    </Link>
  );
}
