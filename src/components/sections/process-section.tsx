import { Section, SectionHeader } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { processSteps } from "@/data/process";

/**
 * The seven delivery stages as a quiet numbered grid. The previous zigzag
 * timeline with a gradient spine read as template decoration; a flat grid
 * scans faster and works identically on mobile.
 */
export function ProcessSection() {
  return (
    <Section id="process" className="bg-surface-2">
      <div className="container-page">
        <SectionHeader
          eyebrow="How we work"
          title="A process built on visibility, not surprises"
          description="Seven clear stages, with working software shown in short increments — so you always know where things stand."
        />
        <StaggerGroup className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {processSteps.map((step) => (
            <StaggerItem key={step.step}>
              <div className="flex h-full flex-col">
                <span className="text-muted-foreground text-sm font-semibold tabular-nums">
                  {String(step.step).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </Section>
  );
}
