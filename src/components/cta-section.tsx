import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

interface CtaSectionProps {
  title?: string;
  description?: string;
  className?: string;
}

export function CtaSection({
  title = "Let's build something that lasts.",
  description = "Tell us what you're working on. We'll reply within one business day with thoughts on how we can help.",
  className,
}: CtaSectionProps) {
  return (
    <section className={cn("container-page py-20 sm:py-28", className)}>
      <Reveal>
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-6 py-16 text-center shadow-[var(--shadow-lift)] sm:px-16 sm:py-20">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at center, black, transparent 72%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at center, black, transparent 72%)",
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {title}
            </h2>
            <p className="text-primary-foreground/85 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
              {description}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-background text-foreground hover:bg-background/90"
              >
                <Link href="/contact">
                  Start a project
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              >
                <Link href="/portfolio">View our work</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
