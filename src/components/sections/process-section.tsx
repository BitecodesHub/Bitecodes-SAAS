import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { processSteps } from "@/data/process";

/**
 * Delivery stages as an editorial spec list beside a sticky introduction.
 * A numbered rail scans faster than a zigzag timeline and keeps the page from
 * repeating the centered-header-plus-grid rhythm used by the sections above.
 */
export function ProcessSection() {
  return (
    <Section id="process" className="bg-surface-2">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                How we work
              </p>
              <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl md:leading-[1.08]">
                A process built on visibility, not surprises.
              </h2>
              <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed">
                Seven clear stages, with working software shown in short
                increments — so you always know where things stand.
              </p>
              <Link
                href="/process"
                className="text-foreground decoration-border hover:decoration-foreground mt-6 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 transition-colors"
              >
                See how a project runs
                <ArrowRight className="size-4" />
              </Link>
            </Reveal>
          </div>

          <ol className="border-border border-t">
            {processSteps.map((step) => (
              <li
                key={step.step}
                className="border-border grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-1 border-b py-6 sm:grid-cols-[3rem_1fr] sm:gap-x-6"
              >
                <span className="text-muted-foreground pt-0.5 text-sm font-semibold tabular-nums">
                  {String(step.step).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}
