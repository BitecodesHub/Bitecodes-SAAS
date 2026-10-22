import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

/**
 * Hero — benefit-led headline, two-CTA offer, and a single verifiable trust
 * strip. No gradient text, no glow, no mesh background, no pill eyebrows.
 * Rendered as a server component: LCP content paints immediately with zero
 * layout shift.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container-page flex flex-col items-center pt-28 pb-20 text-center sm:pt-36 sm:pb-28">
        <Reveal direction="up">
          <h1 className="max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-7xl md:text-8xl">
            Custom Web, App and AI Development for Growing Businesses
          </h1>
        </Reveal>

        <Reveal direction="up" delay={1}>
          <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
            <span className="text-foreground font-medium">
              {siteConfig.name}
            </span>{" "}
            partners with small and mid-sized businesses in{" "}
            <span className="text-foreground font-medium">
              India and Australia
            </span>{" "}
            to build high-performance websites, web apps, SaaS platforms, and AI
            automation that drive real growth.
          </p>
        </Reveal>

        <Reveal direction="up" delay={2}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link
                href="/website-audit"
                data-track="hero_audit_cta"
                className="min-h-[44px]"
              >
                Get a free website audit
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link
                href="/book-a-call"
                data-track="hero_call_cta"
                className="min-h-[44px]"
              >
                Book a free call
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal direction="none">
          <p className="text-muted-foreground mt-10 text-sm">
            Serving clients in India and Australia since{" "}
            <span className="text-foreground font-medium">
              {siteConfig.founded}
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
