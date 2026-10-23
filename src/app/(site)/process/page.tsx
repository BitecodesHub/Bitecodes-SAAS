import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { ProcessSection } from "@/components/sections/process-section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { processSteps } from "@/data/process";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Process",
  description:
    "Discovery, planning, design, development, testing, deployment, and maintenance — how Bitecodes delivers software with visibility at every step.",
  path: "/process",
});

export default function ProcessPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Process", path: "/process" },
        ])}
      />
      <PageHeader
        eyebrow="Process"
        title="How we turn ideas into shipped software"
        description="A clear, repeatable process built around visibility — so you always know what is happening, why, and what comes next."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Process", href: "/process" },
        ]}
      />
      <ProcessSection />
      <Section spacing="sm" className="bg-surface-2">
        <div className="container-page">
          <h2 className="text-center text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
            What you receive at each stage
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {processSteps.map((step, i) => (
              <Reveal key={step.step} delay={i * 0.04}>
                <div className="bg-background h-full rounded-[24px] p-7">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-[14px]">
                      <step.icon className="size-5" />
                    </span>
                    <h3 className="text-[17px] font-semibold">{step.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {step.deliverables.map((d) => (
                      <li
                        key={d}
                        className="text-muted-foreground flex gap-2.5 text-[14px] leading-relaxed"
                      >
                        <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>
      <CtaSection />
    </>
  );
}
