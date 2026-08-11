import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

interface CtaAction {
  label: string;
  href: string;
}

interface CtaSectionProps {
  title?: string;
  description?: string;
  className?: string;
  /**
   * The two buttons.
   *
   * Defaulted to the studio's own call to action — "tell us about your
   * project" — because that is what most of the site is selling. The product
   * pages override them: a chatbot, a form or a calendar is something a visitor
   * can have working in a minute by signing up, and asking them to fill in a
   * contact form instead is asking them to wait a day for something that needs
   * nobody's involvement.
   */
  primary?: CtaAction;
  secondary?: CtaAction;
}

export function CtaSection({
  title = "Let's build something that lasts.",
  description = "Tell us what you're working on. We'll reply within one business day with thoughts on how we can help.",
  className,
  primary = { label: "Start a project", href: "/contact" },
  secondary = { label: "View our work", href: "/portfolio" },
}: CtaSectionProps) {
  return (
    <section className={cn("container-page py-20 sm:py-28", className)}>
      <Reveal>
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-16 sm:py-20">
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
                <Link href={primary.href}>
                  {primary.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              >
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
