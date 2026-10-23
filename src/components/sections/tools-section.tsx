import Link from "next/link";
import { ArrowRight, Calculator, LockKeyhole, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

/**
 * One dark band per page. It marks the free tools as a different kind of
 * offer — usable now, no account — and gives the white sections on either
 * side a deliberate edge.
 */
export function ToolsSection() {
  return (
    <section className="bg-[#1d1d1f] text-white dark:bg-[#101012]">
      <div className="container-page grid gap-10 py-24 sm:py-32 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <Reveal>
          <p className="text-[13px] font-semibold tracking-[0.14em] text-white/50 uppercase">
            Free planning tools
          </p>
          <h2 className="mt-5 max-w-3xl text-[clamp(2.25rem,4.8vw,4.25rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
            Turn an early idea into a realistic range.
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.6] text-pretty text-white/65 sm:text-[19px]">
            Configure a website, mobile app, SaaS MVP, enterprise platform, or
            AI workflow. See the estimate immediately — no account or email
            wall.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-[14px] text-white/65">
            <span className="flex items-center gap-2">
              <Calculator className="size-4" aria-hidden />
              India-calibrated INR ranges
            </span>
            <span className="flex items-center gap-2">
              <TimerReset className="size-4" aria-hidden />
              Timeline and team guidance
            </span>
            <span className="flex items-center gap-2">
              <LockKeyhole className="size-4" aria-hidden />
              Private until you share
            </span>
          </div>
        </Reveal>

        <Reveal className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <Button
            asChild
            size="lg"
            className="bg-white text-[#1d1d1f] hover:bg-white/90"
          >
            <Link href="/project-cost-calculator">
              Calculate project cost
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="border border-white/25 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/tools">Explore all tools</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
