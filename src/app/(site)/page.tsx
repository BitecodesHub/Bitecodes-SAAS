import { Hero } from "@/components/sections/hero";
import { StatsSection } from "@/components/sections/stats-section";
import { FeaturedWorkSection } from "@/components/sections/featured-work-section";
import { ServicesSection } from "@/components/sections/services-section";
import { ProcessSection } from "@/components/sections/process-section";
import { TestimonialsStrip } from "@/components/proof/testimonials-strip";
import { PricingPreviewSection } from "@/components/sections/pricing-preview-section";
import { FaqSection } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, faqSchema } from "@/lib/seo";
import { faqs } from "@/data/faqs";

const HOME_TITLE = "Bitecodes | Web, App and AI Development Studio in India";
const HOME_DESCRIPTION =
  "Bitecodes is an India-based software studio building fast websites, web apps, SaaS platforms, APIs, and AI automation for startups and enterprises worldwide.";

const homeMetadata = createMetadata({
  description: HOME_DESCRIPTION,
  path: "/",
});

export const metadata = {
  ...homeMetadata,
  // Absolute rather than templated: the keyword-led title must stay under 60
  // characters, and the layout template would append " — Bitecodes" a second
  // time on the homepage.
  title: { absolute: HOME_TITLE },
  openGraph: {
    ...homeMetadata.openGraph,
    title: HOME_TITLE,
  },
};

export default function HomePage() {
  return (
    <>
      {/*
        Conversion order: promise → proof-numbers → featured work → services
        → process → social proof → pricing → FAQ → close.
      */}
      <JsonLd data={faqSchema(faqs)} />
      <Hero />
      <StatsSection />
      <FeaturedWorkSection />
      <ServicesSection />
      <ProcessSection />
      {/* Renders nothing when no approved testimonials exist */}
      <TestimonialsStrip />
      <PricingPreviewSection />
      <FaqSection limit={6} />
      <CtaSection variant="audit" />
    </>
  );
}
