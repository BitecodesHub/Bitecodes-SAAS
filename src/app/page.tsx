import { Hero } from "@/components/sections/hero";
import { ServicesSection } from "@/components/sections/services-section";
import { WhyChooseSection } from "@/components/sections/why-choose-section";
import { FeaturedWorkSection } from "@/components/sections/featured-work-section";
import { TechSection } from "@/components/sections/tech-section";
import { IndustriesSection } from "@/components/sections/industries-section";
import { ProcessSection } from "@/components/sections/process-section";
import { FounderSection } from "@/components/sections/founder-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { StatsSection } from "@/components/sections/stats-section";
import { FaqSection } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, faqSchema } from "@/lib/seo";
import { faqs } from "@/data/faqs";

export const metadata = createMetadata({
  description:
    "Bitecodes is a software outsourcing studio building fast, reliable websites, web & enterprise apps, SaaS, REST APIs, and AI automation (AI integration & MCP servers) for startups and enterprises worldwide.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqSchema(faqs)} />
      <Hero />
      <ServicesSection />
      <WhyChooseSection />
      <FeaturedWorkSection />
      <StatsSection />
      <TechSection />
      <IndustriesSection />
      <ProcessSection />
      <FounderSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
