import Link from "next/link";
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
 * One statement, one supporting line, one row of hairline-separated actions.
 *
 * The opening carries no cards, no buttons and no fills: the confidence comes
 * from the emptiness around the words, so the first screen is type and air and
 * the live work frame only arrives once the reader scrolls.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container-page flex flex-col items-center justify-center py-20 text-center sm:min-h-svh sm:py-28">
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
          <h1 className="mx-auto mt-8 max-w-[20ch] text-[clamp(2.5rem,5.2vw,4.35rem)] leading-[1.05] font-semibold tracking-[-0.038em] text-balance">
            Custom software.
            <span className="block">
              Built to ship<span className="text-primary">.</span>
            </span>
          </h1>
        </Reveal>

        <Reveal direction="up">
          <p className="text-muted-foreground mx-auto mt-7 max-w-[46ch] text-[17px] leading-[1.6] tracking-[-0.01em] text-pretty sm:max-w-[44rem] sm:text-[19px]">
            Websites, web apps, SaaS platforms and AI automation for growing
            businesses — designed, built and maintained by one senior team.
          </p>
        </Reveal>

        <Reveal direction="up">
          <nav
            aria-label="Ways to start"
            className="mt-10 flex flex-col items-center justify-center gap-x-5 text-[15px] font-medium sm:flex-row sm:flex-wrap"
          >
            <Link
              href="/contact"
              data-track="hero_start_cta"
              className="text-foreground inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              Start a project
            </Link>
            <span aria-hidden className="bg-border hidden h-4 w-px sm:block" />
            <Link
              href="#work"
              data-track="hero_work_cta"
              className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              Selected work
            </Link>
            <span aria-hidden className="bg-border hidden h-4 w-px sm:block" />
            <Link
              href="/website-audit"
              data-track="hero_audit_cta"
              className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              Free website audit
            </Link>
          </nav>
        </Reveal>

        <Reveal direction="none">
          <p className="text-muted-foreground mt-6 flex max-w-[34rem] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] leading-relaxed">
            {/* The separator rides on the end of each item so a wrapped line
                can never start with a floating middot. */}
            {assurances.map((item) => (
              <span
                key={item}
                className="after:ml-2.5 after:content-['·'] last:after:content-none"
              >
                {item}
              </span>
            ))}
          </p>
        </Reveal>
      </div>

      <div className="container-page pb-16 sm:pb-24">
        <Reveal direction="none">
          <HeroShowcase />
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
