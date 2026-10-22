import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            <div className="border-border bg-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-[var(--shadow-soft)]">
              <BookOpen className="text-primary size-4" />
              {answerPages.length} answers, reviewed 22 October 2026
            </div>
          </div>

          <div className="mt-14 space-y-14">
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

      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Need an answer for your situation?
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-relaxed">
            These answers describe the general case. Send the specific one and
            we will reply with a useful, honest response within one business
            day.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/contact" data-track="answers-contact">
                Ask your question
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/book-a-call">Book a free call</Link>
            </Button>
          </div>
        </div>
      </Section>
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
        <h2 className="text-xl font-semibold tracking-tight">{category}</h2>
        <span className="text-muted-foreground text-sm">
          {pages.length} {pages.length === 1 ? "answer" : "answers"}
        </span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {pages.map((page, index) => (
          <Reveal key={page.slug} delay={index * 40}>
            <Link
              href={`/answers/${page.slug}`}
              className="group border-border bg-card hover:border-primary/30 flex h-full flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
              data-track="answer-card"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">{page.category}</Badge>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3.5" />
                  {page.readingMinutes} min
                </span>
              </div>
              <h3 className="group-hover:text-primary mt-4 text-lg leading-snug font-semibold">
                {page.question}
              </h3>
              <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
                {page.shortAnswer}
              </p>
              <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
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
