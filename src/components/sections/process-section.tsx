import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { processSteps } from "@/data/process";

/**
 * Delivery stages as an editorial spec list beside a sticky introduction.
 * Big numerals do real work here: the process is genuinely sequential, so the
 * numbering encodes order rather than decorating the heading.
 */
export function ProcessSection() {
  return (
    <Section id="process">
      <div className="container-page">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
                How we work
              </p>
              <h2 className="mt-5 max-w-md text-[clamp(2.25rem,4.4vw,3.75rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
                A process built on visibility, not surprises.
              </h2>
              <p className="text-muted-foreground mt-5 max-w-md text-[17px] leading-[1.6]">
                Seven clear stages, with working software shown in short
                increments — so you always know where things stand.
              </p>
              <Link
                href="/process"
                className="text-primary mt-7 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium transition-opacity hover:opacity-75"
              >
                See how a project runs
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Reveal>
          </div>

          <ol className="border-t border-black/[0.07] dark:border-white/10">
            {processSteps.map((step) => (
              <li
                key={step.step}
                className="grid grid-cols-[3rem_1fr] gap-x-5 gap-y-1 border-b border-black/[0.07] py-7 sm:grid-cols-[4.5rem_1fr] sm:gap-x-8 dark:border-white/10"
              >
                <span className="text-muted-foreground/50 pt-1 text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[32px]">
                  {String(step.step).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-[21px] font-semibold tracking-[-0.02em]">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
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
