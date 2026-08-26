import { Hero } from "@/components/sections/hero";
import { NotesSection } from "@/components/sections/notes-section";
import { ServicesSection } from "@/components/sections/services-section";
import { ToolsSection } from "@/components/sections/tools-section";
import { PricingPreviewSection } from "@/components/sections/pricing-preview-section";
import { FeaturedWorkSection } from "@/components/sections/featured-work-section";
import { ProcessSection } from "@/components/sections/process-section";
import { StatsSection } from "@/components/sections/stats-section";
import { FaqSection } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, faqSchema } from "@/lib/seo";
import { faqs } from "@/data/faqs";

export const metadata = createMetadata({
  description:
    "Bitecodes is a software outsourcing studio building fast, reliable websites, web and enterprise apps, SaaS, REST APIs, and AI automation for growing businesses.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      {/*
        Deliberately lean: promise → product launch → services → proof →
        numbers → process → tools → pricing → FAQ → close. Industries, the
        tech stack, the blog, and the founder each have a dedicated page;
        repeating them here only made the homepage longer, not more
        convincing.
      */}
      <JsonLd data={faqSchema(faqs)} />
      <Hero />
      <NotesSection />
      <ServicesSection />
      <FeaturedWorkSection />
      <StatsSection />
      <ProcessSection />
      <ToolsSection />
      <PricingPreviewSection />
      <FaqSection limit={6} />
      <CtaSection />
    </>
  );
}
