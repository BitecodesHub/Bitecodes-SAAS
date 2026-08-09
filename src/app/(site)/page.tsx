import { Hero } from "@/components/sections/hero";
import { ServicesSection } from "@/components/sections/services-section";
import { WhyChooseSection } from "@/components/sections/why-choose-section";
import { ToolsSection } from "@/components/sections/tools-section";
import { PricingPreviewSection } from "@/components/sections/pricing-preview-section";
import { BlogPreviewSection } from "@/components/sections/blog-preview-section";
import { FeaturedWorkSection } from "@/components/sections/featured-work-section";
import { TechSection } from "@/components/sections/tech-section";
import { IndustriesSection } from "@/components/sections/industries-section";
import { ProcessSection } from "@/components/sections/process-section";
import { FounderSection } from "@/components/sections/founder-section";
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
      <JsonLd data={faqSchema(faqs)} />
      <Hero />
      <ServicesSection />
      <ToolsSection />
      <WhyChooseSection />
      <FeaturedWorkSection />
      <StatsSection />
      <TechSection />
      <IndustriesSection />
      <ProcessSection />
      <PricingPreviewSection />
      <BlogPreviewSection />
      <FounderSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
