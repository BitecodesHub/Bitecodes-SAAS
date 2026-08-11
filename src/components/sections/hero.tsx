import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

const capabilities = [
  "Product discovery",
  "Senior engineering",
  "Quality assurance",
  "Launch & support",
];

/**
 * Hero — intentionally minimal: headline, one subhead, two CTAs, and a single
 * trust strip. Typography carries it; no decoration. Rendered statically (no
 * motion) so the LCP content paints immediately and there is no
 * above-the-fold layout shift.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container-page flex flex-col items-center pt-28 pb-20 text-center sm:pt-36 sm:pb-28">
        <h1 className="max-w-5xl text-5xl leading-[1.02] font-semibold tracking-[-0.03em] text-balance sm:text-7xl md:text-8xl">
          Software, engineered with intent.
        </h1>

        <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
          <span className="text-foreground font-medium">{siteConfig.name}</span>{" "}
          is a software studio building high-performance websites, web &amp;
          enterprise apps, SaaS, APIs, and AI automation for startups and
          enterprises across the{" "}
          <span className="text-foreground font-medium">
            US, UK, Australia &amp; India
          </span>
          .
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/contact">
              Start a project
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/portfolio">Explore our work</Link>
          </Button>
        </div>

        <div className="mt-16 w-full">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            One accountable team from idea to operation
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-75">
            {capabilities.map((name) => (
              <span
                key={name}
                className="text-sm font-semibold tracking-tight sm:text-base"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
