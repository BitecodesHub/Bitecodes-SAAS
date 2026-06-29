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
      <Section spacing="sm" className="border-border border-t">
        <div className="container-page">
          <h2 className="text-center text-xl font-semibold tracking-tight">
            What you receive at each stage
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processSteps.map((step, i) => (
              <Reveal key={step.step} delay={i * 0.04}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                      <step.icon className="size-5" />
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {step.deliverables.map((d) => (
                      <li
                        key={d}
                        className="text-muted-foreground before:text-primary text-sm before:mr-2 before:content-['—']"
                      >
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
