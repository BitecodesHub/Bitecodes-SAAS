import Link from "next/link";
import { ArrowRight, Calculator, LockKeyhole, TimerReset } from "lucide-react";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

export function ToolsSection() {
  return (
    <Section
      className="border-border bg-foreground text-background border-y"
      spacing="sm"
    >
      <div className="container-page grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-background/60 text-xs font-semibold tracking-[0.18em] uppercase">
            Free planning tools
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Turn an early idea into a realistic cost and delivery range.
          </h2>
          <p className="text-background/65 mt-4 max-w-2xl leading-relaxed">
            Configure a website, mobile app, SaaS MVP, enterprise platform, or
            AI workflow. See the estimate immediately — no account or email
            wall.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <span className="flex items-center gap-2">
              <Calculator className="size-4" />
              India-calibrated INR ranges
            </span>
            <span className="flex items-center gap-2">
              <TimerReset className="size-4" />
              Timeline and team guidance
            </span>
            <span className="flex items-center gap-2">
              <LockKeyhole className="size-4" />
              Private until you choose to share
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Button
            asChild
            size="lg"
            className="bg-background text-foreground hover:bg-background/90"
          >
            <Link href="/project-cost-calculator">
              Calculate project cost
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-background/20 bg-background/5 text-background hover:bg-background/10 hover:text-background"
          >
            <Link href="/tools">Explore all tools</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
