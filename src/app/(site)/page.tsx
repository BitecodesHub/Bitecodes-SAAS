import { Hero } from "@/components/sections/hero";
import { SelectedWorkSection } from "@/components/sections/selected-work-section";
import { ServicesSection } from "@/components/sections/services-section";
import { ProcessSection } from "@/components/sections/process-section";
import { TestimonialsStrip } from "@/components/proof/testimonials-strip";
import { ToolsSection } from "@/components/sections/tools-section";
import { PricingPreviewSection } from "@/components/sections/pricing-preview-section";
import { FaqSection } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, faqSchema } from "@/lib/seo";
import { faqs } from "@/data/faqs";

const HOME_TITLE = "Custom Software, SaaS & AI Development Studio | Bitecodes";
const HOME_DESCRIPTION =
  "Build SaaS products, web applications and AI automations with Bitecodes. Clear project pricing, milestone-based delivery and ongoing engineering support.";

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
        Conversion order: promise → selected work → services → process →
        social proof → free tools → pricing → FAQ → close.
      */}
      <JsonLd data={faqSchema(faqs)} />
      <Hero />
      <SelectedWorkSection />
      <ServicesSection />
      <ProcessSection />
      {/* Renders nothing when no approved testimonials exist */}
      <TestimonialsStrip />
      <ToolsSection />
      <PricingPreviewSection />
      <FaqSection limit={6} />
      <CtaSection variant="audit" />
    </>
  );
}
