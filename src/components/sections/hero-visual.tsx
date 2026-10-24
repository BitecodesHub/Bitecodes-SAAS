import {
  BRAND_BITE_CIRCLES,
  BRAND_BODY_PATH,
  BRAND_CRUMB,
  BRAND_GLYPH_PATHS,
  BRAND_GLYPH_STROKE_WIDTH,
  BRAND_MARK_VIEWBOX,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox={BRAND_MARK_VIEWBOX} aria-hidden className={className}>
      <mask id="hero-orb-mark">
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
        mask="url(#hero-orb-mark)"
      />
      <circle
        cx={BRAND_CRUMB.cx}
        cy={BRAND_CRUMB.cy}
        r={BRAND_CRUMB.r}
        fill="currentColor"
      />
    </svg>
  );
}

const beads = [
  { className: "top-[8%] left-[35%] size-2", delay: "-0.8s" },
  { className: "top-[21%] right-[10%] size-2.5", delay: "-2.4s" },
  { className: "top-[55%] left-[3%] size-3.5", delay: "-1.2s" },
  { className: "top-[72%] right-[13%] size-2", delay: "-3.2s" },
  { className: "bottom-[4%] left-[45%] size-2.5", delay: "-4.1s" },
] as const;

interface OrbitLine {
  rx: number;
  ry: number;
  rotate: number;
  stroke: string;
  width: number;
  duration: string;
  opacity?: number;
  dash?: string;
  dashAnimated?: boolean;
  reverse?: boolean;
}

/**
 * Six rings at different tilts, each turning on its own slow clock. The
 * crossing near-vertical pairs read as meridians, so the artwork feels like a
 * globe rather than a set of concentric ovals. Durations stay between 1.5 and
 * 3.5 minutes: visible on a second look, never a carousel.
 */
const orbitLines: readonly OrbitLine[] = [
  {
    rx: 288,
    ry: 172,
    rotate: -14,
    stroke: "url(#hero-orbit-line)",
    width: 1.35,
    dash: "1 9",
    dashAnimated: true,
    duration: "180s",
  },
  {
    rx: 238,
    ry: 120,
    rotate: 17,
    stroke: "url(#hero-orbit-line-2)",
    width: 1.2,
    duration: "130s",
    reverse: true,
  },
  {
    rx: 204,
    ry: 86,
    rotate: -34,
    stroke: "#a78bfa",
    opacity: 0.42,
    width: 1,
    duration: "95s",
  },
  {
    rx: 154,
    ry: 278,
    rotate: 23,
    stroke: "url(#hero-orbit-line-3)",
    width: 1.1,
    duration: "210s",
    reverse: true,
  },
  {
    rx: 122,
    ry: 252,
    rotate: -38,
    stroke: "#c4b5fd",
    opacity: 0.3,
    width: 0.9,
    dash: "2 8",
    duration: "160s",
  },
  {
    rx: 272,
    ry: 148,
    rotate: 49,
    stroke: "url(#hero-orbit-line-4)",
    width: 1.05,
    dash: "1 12",
    duration: "240s",
    reverse: true,
  },
];

/**
 * The hero artwork: a dark, glossy product orb inside a slowly turning cage of
 * fine orbits and travelling beads. Everything is markup — no hero image to
 * download, nothing to upscale, and it adapts to dark mode and reduced motion.
 * It is decorative, so the whole composition is hidden from assistive tech.
 */
export function HeroVisual() {
  return (
    <div
      aria-hidden
      className="hero-art-scroll relative mx-auto aspect-square w-full max-w-[26rem] sm:max-w-[32rem] xl:max-w-[42rem]"
    >
      <div className="absolute top-1/2 left-1/2 size-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(96,64,244,0.15),transparent_72%)] blur-2xl dark:bg-[radial-gradient(closest-side,rgba(120,86,255,0.24),transparent_72%)]" />

      <svg
        viewBox="0 0 600 600"
        fill="none"
        className="pointer-events-none absolute inset-0 z-[12] h-full w-full"
      >
        <defs>
          <linearGradient
            id="hero-orbit-line"
            x1="90"
            y1="140"
            x2="540"
            y2="470"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8f7bff" stopOpacity="0" />
            <stop offset="0.25" stopColor="#8f7bff" stopOpacity="0.68" />
            <stop offset="0.7" stopColor="#c4b5fd" stopOpacity="0.36" />
            <stop offset="1" stopColor="#8f7bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="hero-orbit-line-2"
            x1="120"
            y1="450"
            x2="520"
            y2="170"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8f7bff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="1" stopColor="#8f7bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="hero-orbit-line-3"
            x1="180"
            y1="80"
            x2="440"
            y2="540"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8f7bff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c4b5fd" stopOpacity="0.44" />
            <stop offset="1" stopColor="#8f7bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="hero-orbit-line-4"
            x1="80"
            y1="300"
            x2="520"
            y2="320"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#a78bfa" stopOpacity="0" />
            <stop offset="0.4" stopColor="#a78bfa" stopOpacity="0.4" />
            <stop offset="0.75" stopColor="#c4b5fd" stopOpacity="0.22" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {orbitLines.map((line) => (
          <g
            key={`${line.rx}-${line.ry}-${line.rotate}`}
            className="hero-orbit-spin"
            style={{
              animationDuration: line.duration,
              animationDirection: line.reverse ? "reverse" : "normal",
            }}
          >
            <ellipse
              cx="300"
              cy="300"
              rx={line.rx}
              ry={line.ry}
              transform={`rotate(${line.rotate} 300 300)`}
              stroke={line.stroke}
              strokeOpacity={line.opacity}
              strokeWidth={line.width}
              strokeDasharray={line.dash}
              strokeLinecap={line.dash ? "round" : undefined}
              className={line.dashAnimated ? "hero-orbit" : undefined}
            />
          </g>
        ))}
      </svg>

      <div className="absolute top-1/2 left-1/2 z-10 aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2">
        <div className="bg-primary/25 dark:bg-primary/25 absolute -inset-[18%] rounded-full blur-3xl" />
        <div className="relative flex size-full items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_34%_26%,#9a89ff_0%,#5b3ce8_22%,#2b1763_48%,#0b0717_78%,#05030b_100%)] shadow-[inset_-18px_-24px_60px_rgba(0,0,0,0.85),inset_12px_14px_44px_rgba(255,255,255,0.16),0_30px_80px_-24px_rgba(76,54,190,0.65)] ring-1 ring-white/10">
          <span className="absolute top-[10%] left-[14%] h-[30%] w-[36%] rounded-full bg-white/25 blur-2xl" />
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_72%_84%,rgba(146,118,255,0.55),transparent_46%)]" />
          <BrandMark className="relative size-[20%] text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]" />
        </div>
      </div>

      {beads.map((bead) => (
        <span
          key={bead.className}
          style={{ animationDelay: bead.delay }}
          className={cn(
            "hero-float absolute z-[14] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e4dcff,#7c3aed_65%,#3b168f)] shadow-[0_0_18px_rgba(124,58,237,0.65)]",
            bead.className,
          )}
        />
      ))}
    </div>
  );
}
