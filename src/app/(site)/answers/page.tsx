import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { CtaSection } from "@/components/cta-section";
import {
  answerCategories,
  answerPages,
  type AnswerCategory,
  type AnswerPage,
} from "@/data/answers";
import { breadcrumbSchema, createMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Answer Library — Straight Answers to Software Questions",
  description:
    "Clear, current answers to the questions buyers ask about website costs, app costs, SaaS timelines, hiring, and getting found by AI search.",
  path: "/answers",
});

export default function AnswersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Answers", path: "/answers" },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path: "/answers",
          name: "Bitecodes answer library",
          description:
            "Answer-first guides to software costs, hiring, delivery, and AI search visibility.",
        })}
      />
      <PageHeader
        eyebrow="Answer library"
        title={
          <>
            Straight answers, <span>no fluff.</span>
          </>
        }
        description="The questions buyers actually ask, answered in the first sentence and supported with the detail that matters. No gated PDFs, no discovery call required."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Answers", href: "/answers" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <div className="bg-surface-2 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px]">
              <BookOpen className="text-primary size-4" />
              {answerPages.length} answers, reviewed 22 October 2026
            </div>
          </div>

          <div className="mt-16 space-y-16">
            {answerCategories.map((category) => {
              const pages = answerPages.filter(
                (page) => page.category === category,
              );
              if (pages.length === 0) return null;
              return (
                <CategoryGroup
                  key={category}
                  category={category}
                  pages={pages}
                />
              );
            })}
          </div>
        </div>
      </Section>

      <CtaSection
        title="Need an answer for your situation?"
        description="These answers describe the general case. Send the specific one and we will reply with a useful, honest response within one business day."
        primary={{
          label: "Ask your question",
          href: "/contact",
          track: "answers-contact",
        }}
        secondary={{
          label: "Book a free call",
          href: "/book-a-call",
          track: "answers-book-call",
        }}
      />
    </>
  );
}

function CategoryGroup({
  category,
  pages,
}: {
  category: AnswerCategory;
  pages: AnswerPage[];
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
          {category}
        </h2>
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {pages.length} {pages.length === 1 ? "answer" : "answers"}
        </span>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {pages.map((page, index) => (
          <Reveal key={page.slug} delay={index * 40}>
            <Link
              href={`/answers/${page.slug}`}
              className="group bg-surface-2 hover:bg-background flex h-full flex-col rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
              data-track="answer-card"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">{page.category}</Badge>
                <span className="text-muted-foreground flex items-center gap-1 text-[13px]">
                  <Clock className="size-3.5" />
                  {page.readingMinutes} min
                </span>
              </div>
              <h3 className="group-hover:text-primary mt-4 text-[21px] leading-[1.25] font-semibold tracking-[-0.015em] transition-colors">
                {page.question}
              </h3>
              <p className="text-muted-foreground mt-2.5 line-clamp-3 flex-1 text-[15px] leading-[1.55]">
                {page.shortAnswer}
              </p>
              <span className="text-primary mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium">
                Read the answer
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
