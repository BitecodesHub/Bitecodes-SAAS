import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqExplorer } from "@/components/faq/faq-explorer";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { faqs } from "@/data/faqs";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers about Bitecodes software services, pricing, delivery process, technology, quality, international collaboration, and post-launch support.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />
      <PageHeader
        eyebrow="FAQ"
        title={
          <>
            Clear answers before you{" "}
            <span className="text-gradient">start.</span>
          </>
        }
        description="Search the questions we hear most often about scope, delivery, pricing, technology, quality, and ongoing support."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "FAQ", href: "/faq" },
        ]}
      />
      <Section spacing="sm">
        <div className="container-page">
          <FaqExplorer faqs={faqs} />
        </div>
      </Section>
      <Section className="border-border bg-secondary/35 border-t" spacing="sm">
        <div className="container-page flex flex-col items-center text-center">
          <h2 className="text-2xl font-semibold">
            Need an answer for your project?
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Share the goal, users, scope, and timing. We respond with practical
            next steps rather than a generic sales script.
          </p>
          <Button asChild variant="gradient" size="lg" className="mt-6">
            <Link href="/contact">
              Ask Bitecodes
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
