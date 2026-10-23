import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Clock,
  X,
} from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  comparisonPages,
  getComparison,
  relatedComparisons,
  type ComparisonPage,
} from "@/data/comparisons";
import { getAnswer, type AnswerPage } from "@/data/answers";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  webPageSchema,
} from "@/lib/seo";

export function generateStaticParams() {
  return comparisonPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparison(slug);
  if (!page) return createMetadata({ title: "Comparison not found" });
  return createMetadata({
    title: page.title,
    description: page.metaDescription,
    path: `/compare/${page.slug}`,
  });
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getComparison(slug);
  if (!page) notFound();

  const path = `/compare/${page.slug}`;
  const related = relatedComparisons(page);
  const relatedAnswerItems = page.related
    .map((item) => getAnswer(item))
    .filter((item): item is AnswerPage => Boolean(item));

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
          { name: page.title, path },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path,
          name: page.title,
          description: page.metaDescription,
          dateModified: page.updated,
          speakableSelectors: ["h1", "main p:first-of-type"],
        })}
      />
      <JsonLd data={faqSchema(page.faqs)} />

      <PageHeader
        eyebrow={`Bitecodes vs ${page.alternativeName}`}
        title={page.title}
        description={page.shortAnswer}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Compare", href: "/compare" },
          { name: page.title, href: path },
        ]}
        align="left"
      />

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-4xl">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              {page.readingMinutes} min read
            </span>
            <span aria-hidden="true">·</span>
            <span>Reviewed 22 October 2026</span>
            <span aria-hidden="true">·</span>
            <span>Typical engagement models, honestly compared</span>
          </div>

          <div className="bg-surface-2 mt-8 overflow-hidden rounded-[24px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-[15px]">
                <caption className="sr-only">
                  Bitecodes compared with {page.alternativeName} across scope,
                  cost, speed, ownership, and risk.
                </caption>
                <thead>
                  <tr className="text-muted-foreground text-[13px] font-semibold tracking-[0.1em] uppercase">
                    <th scope="col" className="px-6 py-5 font-semibold">
                      Dimension
                    </th>
                    <th scope="col" className="px-6 py-5 font-semibold">
                      Bitecodes
                    </th>
                    <th scope="col" className="px-6 py-5 font-semibold">
                      {page.alternativeName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <tr
                      key={row.label}
                      className="border-background border-t align-top"
                    >
                      <th
                        scope="row"
                        className="text-muted-foreground px-6 py-5 font-medium"
                      >
                        {row.label}
                      </th>
                      <td className="px-6 py-5 leading-[1.55]">
                        {row.bitecodes}
                      </td>
                      <td className="text-muted-foreground px-6 py-5 leading-[1.55]">
                        {row.alternative}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Reveal>
              <div className="bg-surface-2 h-full rounded-[24px] p-7">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em]">
                  Choose Bitecodes if…
                </h2>
                <ul className="mt-5 space-y-3">
                  {page.chooseBitecodes.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-[15px] leading-[1.55]"
                    >
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal>
              <div className="bg-surface-2 h-full rounded-[24px] p-7">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em]">
                  Choose {page.alternativeName} if…
                </h2>
                <ul className="mt-5 space-y-3">
                  {page.chooseAlternative.map((item) => (
                    <li
                      key={item}
                      className="text-muted-foreground flex items-start gap-3 text-[15px] leading-[1.55]"
                    >
                      <X className="mt-0.5 size-4 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <div className="bg-foreground text-background mt-10 rounded-[28px] p-7 sm:p-9">
            <div className="flex items-center gap-2.5">
              <CircleDot className="size-5" />
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">
                The honest verdict
              </h2>
            </div>
            <p className="text-background/75 mt-3 text-[17px] leading-[1.65]">
              {page.verdict}
            </p>
          </div>

          <div className="bg-surface-2 mt-12 rounded-[28px] p-7 sm:p-9">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
              Frequently asked
            </h2>
            <dl className="mt-6 space-y-6">
              {page.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-[16px] font-semibold">{faq.question}</dt>
                  <dd className="text-muted-foreground mt-2 text-[15px] leading-[1.65]">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-surface-2 mt-10 flex flex-col items-start justify-between gap-5 rounded-[28px] p-7 sm:flex-row sm:items-center sm:p-9">
            <div>
              <h2 className="text-[21px] font-semibold tracking-[-0.02em]">
                {page.cta.label}
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl text-[15px] leading-[1.55]">
                {page.cta.description}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button asChild>
                <Link href={page.cta.href} data-track="comparison-primary-cta">
                  {page.cta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="bg-background">
                <Link href="/compare">See all comparisons</Link>
              </Button>
            </div>
          </div>

          <div className="mt-10">
            <Link
              href="/compare"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-[15px] font-medium hover:underline"
            >
              <ArrowLeft className="size-4" />
              All comparisons
            </Link>
          </div>
        </div>
      </Section>

      {related.length > 0 || relatedAnswerItems.length > 0 ? (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            {related.length > 0 ? (
              <>
                <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
                  Other comparisons
                </h2>
                <div className="mt-8 grid gap-3 md:grid-cols-2">
                  {related.map((item) => (
                    <RelatedCard key={item.slug} page={item} />
                  ))}
                </div>
              </>
            ) : null}
            {relatedAnswerItems.length > 0 ? (
              <div className={related.length > 0 ? "mt-14" : undefined}>
                <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
                  Related answers
                </h2>
                <div className="mt-8 grid gap-3 md:grid-cols-2">
                  {relatedAnswerItems.map((item) => (
                    <RelatedAnswerCard key={item.slug} page={item} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function RelatedCard({ page }: { page: ComparisonPage }) {
  return (
    <Link
      href={`/compare/${page.slug}`}
      className="group bg-background rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
      data-track="comparison-related"
    >
      <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.1em] uppercase">
        Bitecodes vs {page.alternativeName}
      </p>
      <h3 className="group-hover:text-primary mt-3 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] transition-colors">
        {page.title}
      </h3>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-[15px] leading-[1.55]">
        {page.shortAnswer}
      </p>
    </Link>
  );
}

function RelatedAnswerCard({ page }: { page: AnswerPage }) {
  return (
    <Link
      href={`/answers/${page.slug}`}
      className="group bg-background rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
      data-track="comparison-related-answer"
    >
      <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.1em] uppercase">
        {page.category}
      </p>
      <h3 className="group-hover:text-primary mt-3 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] transition-colors">
        {page.question}
      </h3>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-[15px] leading-[1.55]">
        {page.shortAnswer}
      </p>
    </Link>
  );
}
