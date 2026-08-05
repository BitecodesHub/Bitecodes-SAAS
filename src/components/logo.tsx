import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import {
  BRAND_BITE_CIRCLES,
  BRAND_BODY_PATH,
  BRAND_CRUMB,
  BRAND_GLYPH_PATHS,
  BRAND_GLYPH_STROKE_WIDTH,
  BRAND_MARK_VIEWBOX,
} from "@/lib/brand";

interface LogoProps {
  className?: string;
  /** Hide the wordmark, showing only the mark. */
  iconOnly?: boolean;
  href?: string | null;
}

/**
 * Bitecodes brand mark + wordmark. Pure SVG, no external assets.
 *
 * The mark fills with `currentColor` on a transparent background, so it is
 * black on the light theme and white on the dark theme with no variants to
 * maintain. Geometry lives in `src/lib/brand.ts`.
 */
export function Logo({ className, iconOnly = false, href = "/" }: LogoProps) {
  // The mask id must be unique per instance: the header and footer both
  // render a Logo, and duplicate SVG ids silently break one of them.
  const maskId = useId();

  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox={BRAND_MARK_VIEWBOX}
        className="size-8 shrink-0"
        role="img"
        aria-label={`${siteConfig.name} logo`}
      >
        <mask id={maskId}>
          <path d={BRAND_BODY_PATH} fill="#fff" />
          {BRAND_BITE_CIRCLES.map((c) => (
            <circle key={c.cx} cx={c.cx} cy={c.cy} r={c.r} fill="#000" />
          ))}
          <g stroke="#000" strokeWidth={BRAND_GLYPH_STROKE_WIDTH} fill="none">
            {BRAND_GLYPH_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </mask>
        <rect
          width="100"
          height="100"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
        <circle
          cx={BRAND_CRUMB.cx}
          cy={BRAND_CRUMB.cy}
          r={BRAND_CRUMB.r}
          fill="currentColor"
        />
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
