import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { HeroVisual } from "@/components/sections/hero-visual";

/**
 * Promise on the left, a single product orb on the right: a dark, glossy
 * sphere ringed by fine orbits. The artwork is built from markup so it stays
 * sharp, adapts to dark mode, and costs no image request.
 */
export function Hero() {
  // `overflow-clip` keeps the art contained without creating a scroll
  // container, so the globe's view timeline tracks the page.
  return (
    <section className="relative overflow-clip">
      <div className="container-page grid items-center gap-10 pt-24 pb-14 sm:gap-12 sm:pt-28 sm:pb-16 xl:min-h-svh xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-8 xl:pt-28 xl:pb-20">
        <div className="relative z-10">
          <Reveal direction="none">
            <p className="text-muted-foreground inline-flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.14em] uppercase">
              <span
                className="bg-primary relative flex size-1.5 rounded-full"
                aria-hidden
              />
              Bitecodes · Software studio
            </p>
          </Reveal>

          <Reveal direction="up">
            <h1 className="mt-6 text-[clamp(2.75rem,4.9vw,4.35rem)] leading-[1.03] font-semibold tracking-[-0.045em] text-balance">
              Custom software.
              <span className="block">
                Built to ship<span className="text-primary">.</span>
              </span>
            </h1>
          </Reveal>

          <Reveal direction="up">
            <p className="text-muted-foreground mt-6 max-w-[34rem] text-[17px] leading-[1.6] tracking-[-0.01em] text-pretty sm:mt-7 sm:text-[18px]">
              Websites, web apps, SaaS platforms and AI automation for growing
              businesses — designed, built and maintained by one senior team.
            </p>
          </Reveal>

          <Reveal direction="up">
            <div className="mt-8 flex flex-col items-start gap-4 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/contact" data-track="hero_start_cta">
                  Start a project
                  <ArrowRight />
                </Link>
              </Button>
              <div className="flex items-center gap-5 text-[15px] font-medium">
                <span
                  aria-hidden
                  className="bg-border hidden h-4 w-px sm:block"
                />
                <Link
                  href="#work"
                  data-track="hero_work_cta"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  Selected work
                </Link>
                <span aria-hidden className="bg-border h-4 w-px" />
                <Link
                  href="/website-audit"
                  data-track="hero_audit_cta"
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  Free website audit
                </Link>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal direction="none" className="relative">
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
}
