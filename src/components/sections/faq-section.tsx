import { Section, SectionHeader } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { FaqDetails } from "@/components/faq/faq-details";
import { faqs as allFaqs } from "@/data/faqs";
import type { Faq } from "@/types/content";

export function FaqSection({
  faqs = allFaqs,
  limit,
}: {
  faqs?: Faq[];
  limit?: number;
}) {
  const items = limit ? faqs.slice(0, limit) : faqs;
  return (
    <Section id="faq">
      <div className="container-page">
        <SectionHeader
          eyebrow="FAQ"
          title="Questions, answered"
          description="A few of the things teams ask before working with us. Have another? Just reach out."
        />
        <Reveal className="mx-auto mt-12 max-w-3xl">
          <FaqDetails faqs={items} />
        </Reveal>
      </div>
    </Section>
  );
}
