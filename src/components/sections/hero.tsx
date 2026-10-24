import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { HeroVisual } from "@/components/sections/hero-visual";

const assurances = [
  "Transparent pricing",
  "Milestone delivery",
  "Direct engineer access",
];

const capabilities = [
  "SaaS platforms",
  "AI automation",
  "Web applications",
  "Enterprise software",
  "Marketing websites",
  "Product design",
  "Cloud & DevOps",
];

/**
 * Promise on the left, a live product atmosphere on the right: a glossy orb
 * ringed by orbits with capability cards floating in front. The artwork is
 * built from markup so it stays sharp, adapts to dark mode, and costs no image
 * request. A hairline capability strip closes the opening.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
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

          <Reveal direction="none">
            <p className="text-muted-foreground mt-7 flex max-w-[34rem] flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] leading-relaxed sm:text-[15px]">
              {/* The separator rides on the end of each item so a wrapped line
                  can never start with a floating middot. Hidden on mobile,
                  where the row wraps. */}
              {assurances.map((item) => (
                <span
                  key={item}
                  className="after:ml-2.5 after:content-['·'] last:after:content-none max-sm:after:hidden"
                >
                  {item}
                </span>
              ))}
            </p>
          </Reveal>
        </div>

        <Reveal direction="none" className="relative">
          <HeroVisual />
        </Reveal>
      </div>

      <div className="border-y border-black/[0.06] dark:border-white/10">
        <div className="container-page flex items-center gap-6 py-3.5">
          <span className="text-muted-foreground hidden shrink-0 text-[11px] font-semibold tracking-[0.14em] uppercase sm:inline">
            What we build
          </span>
          <span
            className="hidden h-3 w-px shrink-0 bg-black/10 sm:block dark:bg-white/15"
            aria-hidden
          />
          <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            <div className="hero-marquee flex w-max items-center">
              {[...capabilities, ...capabilities].map((capability, index) => (
                <span
                  key={`${capability}-${index}`}
                  aria-hidden={index >= capabilities.length ? true : undefined}
                  className="text-muted-foreground flex items-center text-[13px] font-medium tracking-[0.02em] whitespace-nowrap"
                >
                  {capability}
                  <span
                    className="bg-primary/40 mx-7 size-1 rounded-full sm:mx-9"
                    aria-hidden
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
