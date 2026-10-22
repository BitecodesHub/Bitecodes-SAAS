import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

interface CtaAction {
  label: string;
  href: string;
  /** Analytics tracking attribute value. */
  track?: string;
}

/** Built-in presets. Custom props always override the preset defaults. */
type CtaVariant = "audit" | "call" | "project";

interface CtaSectionProps {
  /**
   * Preset variant:
   * - "audit"   → promote the free website audit (primary CTA)
   * - "call"    → promote the free strategy call (primary CTA)
   * - "project" → generic "start a project" (default)
   */
  variant?: CtaVariant;
  title?: string;
  description?: string;
  className?: string;
  primary?: CtaAction;
  secondary?: CtaAction;
}

const PRESETS: Record<
  CtaVariant,
  {
    title: string;
    description: string;
    primary: CtaAction;
    secondary: CtaAction;
  }
> = {
  audit: {
    title: "Find out what's holding your website back.",
    description:
      "We'll review your site's speed, SEO, accessibility, and conversion path — then send you a prioritised action list. No catch, no commitment.",
    primary: {
      label: "Get a free website audit",
      href: "/website-audit",
      track: "cta_section_audit_primary",
    },
    secondary: {
      label: "Book a free call instead",
      href: "/book-a-call",
      track: "cta_section_audit_secondary",
    },
  },
  call: {
    title: "Not sure where to start? Talk to us.",
    description:
      "Book a free 30-minute strategy call. We'll listen, ask the right questions, and give you honest advice — whether you end up working with us or not.",
    primary: {
      label: "Book a free call",
      href: "/book-a-call",
      track: "cta_section_call_primary",
    },
    secondary: {
      label: "Get a free website audit",
      href: "/website-audit",
      track: "cta_section_call_secondary",
    },
  },
  project: {
    title: "Let's build something that lasts.",
    description:
      "Tell us what you're working on. We'll reply within one business day with thoughts on how we can help.",
    primary: {
      label: "Start a project",
      href: "/contact",
      track: "cta_section_project_primary",
    },
    secondary: {
      label: "View our work",
      href: "/portfolio",
      track: "cta_section_project_secondary",
    },
  },
};

export function CtaSection({
  variant = "project",
  title,
  description,
  className,
  primary,
  secondary,
}: CtaSectionProps) {
  const preset = PRESETS[variant];
  const resolvedTitle = title ?? preset.title;
  const resolvedDescription = description ?? preset.description;
  const resolvedPrimary = primary ?? preset.primary;
  const resolvedSecondary = secondary ?? preset.secondary;

  return (
    <section className={cn("container-page py-20 sm:py-28", className)}>
      <Reveal>
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-16 sm:py-20">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {resolvedTitle}
            </h2>
            <p className="text-primary-foreground/85 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
              {resolvedDescription}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-background text-foreground hover:bg-background/90 min-h-[44px]"
              >
                <Link
                  href={resolvedPrimary.href}
                  data-track={resolvedPrimary.track}
                >
                  {resolvedPrimary.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 min-h-[44px] bg-transparent"
              >
                <Link
                  href={resolvedSecondary.href}
                  data-track={resolvedSecondary.track}
                >
                  {resolvedSecondary.label}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
