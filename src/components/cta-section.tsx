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

/**
 * The closing statement. A single full-bleed graphite band gives every page a
 * deliberate ending and makes the two actions the only bright objects in view.
 */
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
    <section
      className={cn("bg-[#1d1d1f] text-white dark:bg-[#101012]", className)}
    >
      <div className="container-page py-24 sm:py-32">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.03] font-semibold tracking-[-0.035em] text-balance">
            {resolvedTitle}
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.6] text-pretty text-white/65 sm:text-[19px]">
            {resolvedDescription}
          </p>
          <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#1d1d1f] hover:bg-white/90"
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
              variant="ghost"
              className="border border-white/25 text-white hover:bg-white/10 hover:text-white"
            >
              <Link
                href={resolvedSecondary.href}
                data-track={resolvedSecondary.track}
              >
                {resolvedSecondary.label}
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
