import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

const trustLogos = [
  "Sublime Care",
  "ConceptServe",
  "Saanvi",
  "Vertex Media",
  "Rivala Care",
  "HireBound",
];

/**
 * Hero — intentionally minimal: pill, headline, one subhead, two CTAs, and a
 * single trust strip. Rendered statically (no motion) so the LCP content paints
 * immediately and there is no above-the-fold layout shift.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient background — a single, soft accent wash on the white canvas. */}
      <div
        aria-hidden="true"
        className="bg-mesh pointer-events-none absolute inset-0 -z-10"
      >
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_60%)] opacity-50" />
      </div>

      <div className="container-page flex flex-col items-center pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <Link
          href="/services/ai-integration"
          className="group glass gradient-ring text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm shadow-sm transition-colors"
        >
          <Sparkles className="text-brand-1 size-3.5" />
          <span>AI integration &amp; MCP servers, done right</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <h1 className="mt-8 max-w-5xl text-5xl leading-[0.98] font-semibold tracking-[-0.03em] text-balance sm:text-7xl md:text-8xl">
          Software,{" "}
          <span className="text-gradient">engineered with intent.</span>
        </h1>

        <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
          <span className="text-foreground font-medium">{siteConfig.name}</span>{" "}
          is a software studio building high-performance websites, web &amp;
          enterprise apps, SaaS, APIs, and AI automation — for startups and
          enterprises worldwide.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg">
            <Link href="/contact">
              Start a project
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="glass" size="lg">
            <Link href="/portfolio">Explore our work</Link>
          </Button>
        </div>

        <div className="mt-16 w-full">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Trusted by teams in 6 countries
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-70">
            {trustLogos.map((name) => (
              <span
                key={name}
                className="text-base font-semibold tracking-tight sm:text-lg"
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
