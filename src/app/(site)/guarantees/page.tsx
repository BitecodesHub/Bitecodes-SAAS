import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { FaqDetails } from "@/components/faq/faq-details";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { guarantees, guaranteeFaqs } from "@/data/guarantees";
import { services } from "@/data/services";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Guarantees",
  description:
    "The process commitments Bitecodes works to: a written fixed quote, milestone payments, client ownership of code, a 30-day defect-fix window, support response targets, and no lock-in.",
  path: "/guarantees",
});

const serviceTitleBySlug = new Map(
  services.map((service) => [service.slug, service.title]),
);

export default function GuaranteesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Guarantees", path: "/guarantees" },
        ])}
      />
      <JsonLd data={faqSchema(guaranteeFaqs)} />
      <PageHeader
        eyebrow="Guarantees"
        title="Clear commitments, in writing."
        description="These are the process commitments we work to on every engagement. Each one states what it covers and where its limits are, so expectations are agreed before work begins."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Guarantees", href: "/guarantees" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page max-w-3xl">
          <p className="text-muted-foreground text-[19px] leading-[1.6]">
            The signed proposal and statement of work set the binding terms for
            an engagement. This page explains the commitments we bring to that
            agreement. If a point matters to your organisation, ask us to
            confirm it in writing before you sign.
          </p>
        </div>
      </Section>

      <Section spacing="sm" className="bg-surface-2">
        <div className="container-page">
          <div className="grid gap-5 lg:grid-cols-2">
            {guarantees.map((guarantee) => {
              const appliesTo = guarantee.appliesTo.includes("all")
                ? ["All services"]
                : guarantee.appliesTo.map(
                    (slug) => serviceTitleBySlug.get(slug) ?? slug,
                  );
              return (
                <Reveal key={guarantee.slug}>
                  <article className="bg-background flex h-full flex-col rounded-[28px] p-7">
                    <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
                      {guarantee.title}
                    </h2>
                    <p className="mt-3 text-[16px] leading-relaxed">
                      {guarantee.commitment}
                    </p>
                    <ul className="mt-5 space-y-3">
                      {guarantee.details.map((detail) => (
                        <li
                          key={detail}
                          className="text-muted-foreground flex items-start gap-3 text-[15px] leading-relaxed"
                        >
                          <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                            <Check className="size-3.5" />
                          </span>
                          {detail}
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground mt-auto pt-6 text-[13px]">
                      Applies to:{" "}
                      {guarantee.appliesTo.includes("all") ? (
                        appliesTo[0]
                      ) : (
                        <span>
                          {guarantee.appliesTo.map((slug, index) => (
                            <span key={slug}>
                              {index > 0 && ", "}
                              <Link
                                href={`/services/${slug}`}
                                className="hover:text-foreground underline underline-offset-4"
                              >
                                {serviceTitleBySlug.get(slug) ?? slug}
                              </Link>
                            </span>
                          ))}
                        </span>
                      )}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="max-w-3xl text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
            Questions about the commitments
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[17px] leading-relaxed">
            How the commitments interact with the contract, defects, timelines,
            and support.
          </p>
          <FaqDetails faqs={guaranteeFaqs} className="mt-8 max-w-3xl" />
        </div>
      </Section>

      <CtaSection
        title="Ask before you sign."
        description="If a commitment needs to be adapted to your procurement or compliance process, raise it early. We will confirm what can be agreed in writing."
        primary={{ label: "Talk to us", href: "/contact" }}
        secondary={{ label: "See the process", href: "/process" }}
      />
    </>
  );
}
