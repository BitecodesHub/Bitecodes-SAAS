import { Quote } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { testimonials } from "@/data/testimonials";

export function TestimonialsSection() {
  return (
    <Section id="testimonials">
      <div className="container-page">
        <SectionHeader
          eyebrow="Testimonials"
          title="What it's like to work with us"
          description="Feedback from the teams we have partnered with across healthcare, media, recruitment, and technology."
        />
        <StaggerGroup className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerItem key={t.company}>
              <figure className="border-border bg-card flex h-full flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                <Quote className="text-primary/40 size-7" />
                <blockquote className="mt-4 flex-1 leading-relaxed text-pretty">
                  “{t.quote}”
                </blockquote>
                <figcaption className="border-border mt-6 border-t pt-4">
                  <p className="text-sm font-semibold">{t.role}</p>
                  <p className="text-muted-foreground text-sm">{t.company}</p>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </Section>
  );
}
