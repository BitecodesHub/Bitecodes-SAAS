import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { HeroShowcase } from "@/components/sections/hero-showcase";

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
 * Hero — an editorial split: the claim and the offer on the left, a live,
 * interactive index of real deployed work on the right. The work itself is the
 * artwork; a slow capabilities strip carries the eye into the page.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="bg-surface-2/70 border-border/60 absolute inset-y-0 right-0 left-1/2 hidden border-l lg:block"
      />
      <div className="container-page relative pt-24 pb-16 sm:pt-28 sm:pb-20 lg:pt-32 lg:pb-24">
        <div className="grid items-center gap-16 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
          <div className="max-w-2xl">
            <Reveal direction="none">
              <div className="flex items-center gap-3">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                  <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
                </span>
                <p className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                  Bitecodes · Software studio
                </p>
                <span className="bg-border h-px flex-1" aria-hidden />
              </div>
            </Reveal>

            <Reveal direction="up">
              <h1 className="mt-6 text-[clamp(2.75rem,5.6vw,4.6rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance">
                Custom software.
                <span className="block">
                  Built to ship<span className="text-primary">.</span>
                </span>
              </h1>
            </Reveal>

            <Reveal direction="up" delay={1}>
              <p className="text-muted-foreground mt-7 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
                Websites, web apps, SaaS platforms and AI automation for growing
                businesses — designed, built, and maintained by one senior team.
              </p>
            </Reveal>

            <Reveal direction="up" delay={2}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg">
                  <Link href="/contact" data-track="hero_start_cta">
                    Start a project
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="#work" data-track="hero_work_cta">
                    See selected work
                  </Link>
                </Button>
              </div>
            </Reveal>

            <Reveal direction="none">
              <p className="text-muted-foreground mt-5 text-sm">
                <Link
                  href="/website-audit"
                  data-track="hero_audit_cta"
                  className="hover:text-foreground decoration-border underline underline-offset-4 transition-colors"
                >
                  Not ready to talk? Get a free website audit
                </Link>
              </p>
            </Reveal>

            <Reveal direction="none">
              <ul className="border-border mt-10 grid gap-x-6 gap-y-3 border-t pt-6 sm:grid-cols-3">
                {assurances.map((item, index) => (
                  <li key={item} className="flex items-baseline gap-2">
                    <span className="text-primary font-mono text-[10px]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal direction="left" className="lg:pl-8 xl:pl-10">
            <HeroShowcase />
          </Reveal>
        </div>
      </div>

      <div className="border-border/80 bg-background relative border-y">
        <div className="container-page flex items-center gap-6 py-3.5">
          <span className="text-muted-foreground hidden shrink-0 font-mono text-[10px] tracking-[0.18em] uppercase sm:inline">
            What we build
          </span>
          <span
            className="bg-border hidden h-3 w-px shrink-0 sm:block"
            aria-hidden
          />
          <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            <div className="hero-marquee flex w-max items-center">
              {[...capabilities, ...capabilities].map((capability, index) => (
                <span
                  key={`${capability}-${index}`}
                  aria-hidden={index >= capabilities.length || undefined}
                  className="text-muted-foreground flex items-center font-mono text-[10px] tracking-[0.18em] whitespace-nowrap uppercase"
                >
                  {capability}
                  <span
                    className="bg-primary/40 mx-6 size-1 rounded-full sm:mx-8"
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
