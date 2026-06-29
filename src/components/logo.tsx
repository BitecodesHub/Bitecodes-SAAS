import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

interface LogoProps {
  className?: string;
  /** Hide the wordmark, showing only the mark. */
  iconOnly?: boolean;
  href?: string | null;
}

/** Bitecodes brand mark + wordmark. Pure SVG, no external assets. */
export function Logo({ className, iconOnly = false, href = "/" }: LogoProps) {
  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label={`${siteConfig.name} logo`}
      >
        <defs>
          <linearGradient id="bc-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.66 0.2 286)" />
            <stop offset="50%" stopColor="oklch(0.6 0.2 264)" />
            <stop offset="100%" stopColor="oklch(0.68 0.16 222)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#bc-logo)" />
        <path
          d="M11.5 9.5 L7 16 l4.5 6.5"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.5 9.5 L25 16 l-4.5 6.5"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <circle cx="16" cy="16" r="1.6" fill="white" />
      </svg>
      {!iconOnly && (
        <span className="text-lg font-semibold tracking-tight">
          {siteConfig.name}
        </span>
      )}
    </span>
  );

  if (href === null) return content;

  return (
    <Link
      href={href}
      className="focus-visible:ring-ring focus-visible:ring-offset-background inline-flex rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${siteConfig.name} — home`}
    >
      {content}
    </Link>
  );
}
