"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import type { Faq } from "@/types/content";

export function FaqExplorer({ faqs }: { faqs: Faq[] }) {
  const [query, setQuery] = React.useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? faqs.filter((faq) =>
        `${faq.question} ${faq.answer}`.toLowerCase().includes(normalized),
      )
    : faqs;

  return (
    <div>
      <label htmlFor="faq-search" className="sr-only">
        Search frequently asked questions
      </label>
      <div className="relative mx-auto max-w-2xl">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
        <Input
          id="faq-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pricing, process, technology, support…"
          className="h-12 pl-11"
        />
      </div>
      <p
        className="text-muted-foreground mt-4 text-center text-sm"
        aria-live="polite"
      >
        {filtered.length} {filtered.length === 1 ? "answer" : "answers"}
      </p>
      {filtered.length ? (
        <Accordion type="single" collapsible className="mx-auto mt-8 max-w-3xl">
          {filtered.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="border-border bg-card mx-auto mt-8 max-w-2xl rounded-2xl border p-8 text-center">
          <h2 className="font-semibold">No matching answer</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Try a broader phrase, or contact us for a project-specific answer.
          </p>
        </div>
      )}
    </div>
  );
}
