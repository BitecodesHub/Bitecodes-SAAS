import { Section, SectionHeader } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { processSteps } from "@/data/process";

export function ProcessSection() {
  return (
    <Section id="process">
      <div className="container-page">
        <SectionHeader
          eyebrow="How we work"
          title="A process built on visibility, not surprises"
          description="Seven clear stages, with working software shown in short increments — so you always know where things stand."
        />
        <div className="relative mt-16">
          {/* Connecting line */}
          <div
            aria-hidden="true"
            className="from-brand-1 via-brand-2 to-brand-3 absolute top-2 bottom-2 left-[1.35rem] w-px bg-gradient-to-b md:left-1/2 md:-translate-x-1/2"
          />
          <ol className="space-y-8 md:space-y-12">
            {processSteps.map((step, i) => (
              <li key={step.step} className="relative">
                <Reveal direction={i % 2 === 0 ? "right" : "left"}>
                  <div
                    className={`flex items-start gap-5 md:w-1/2 ${
                      i % 2 === 0
                        ? "md:ml-auto md:flex-row-reverse md:pl-10 md:text-right"
                        : "md:pr-10"
                    }`}
                  >
                    <span className="border-border bg-card text-primary relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border shadow-[var(--shadow-soft)]">
                      <step.icon className="size-5" />
                    </span>
                    <div className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
                      <div
                        className={`flex items-center gap-2 ${
                          i % 2 === 0 ? "md:flex-row-reverse" : ""
                        }`}
                      >
                        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Step {step.step}
                        </span>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}
