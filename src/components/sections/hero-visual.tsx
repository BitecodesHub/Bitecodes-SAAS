import type { ReactNode } from "react";
import { ArrowUpRight, BarChart3, Check, Code2, Sparkles } from "lucide-react";
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

interface FloatingCardProps {
  className?: string;
  delay: string;
  icon: ReactNode;
  iconClassName?: string;
  title: string;
  description: string;
}

function FloatingCard({
  className,
  delay,
  icon,
  iconClassName,
  title,
  description,
}: FloatingCardProps) {
  return (
    <div
      style={{ animationDelay: delay }}
      className={cn(
        "hero-float absolute z-20 w-[13.5rem] rounded-2xl border border-white/70 bg-white/85 p-3.5 shadow-[0_22px_50px_-26px_rgba(35,20,90,0.45)] backdrop-blur-xl sm:w-[15.5rem] sm:p-4 dark:border-white/10 dark:bg-white/[0.07] dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[10px] sm:size-9 sm:rounded-xl",
            iconClassName,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug font-semibold tracking-[-0.01em] sm:text-[15px]">
            {title}
          </p>
          <p className="text-muted-foreground mt-1 text-[13px] leading-[1.4] dark:text-white/60">
            {description}
          </p>
        </div>
        <ArrowUpRight
          className="text-muted-foreground/70 size-3.5 shrink-0"
          aria-hidden
        />
      </div>
    </div>
  );
}

function CodeCard() {
  return (
    <div
      style={{ animationDelay: "-3.5s" }}
      className="hero-float absolute bottom-[4%] left-[2%] z-30 hidden w-[15rem] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0714] p-4 shadow-[0_26px_60px_-24px_rgba(0,0,0,0.8)] xl:block"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[#ff5f57]" />
        <span className="size-1.5 rounded-full bg-[#febc2e]" />
        <span className="size-1.5 rounded-full bg-[#28c840]" />
        <span className="ml-auto font-mono text-[10px] tracking-[0.12em] text-white/35 uppercase">
          app.ts
        </span>
      </div>
      <pre className="font-mono text-[12px] leading-[1.75] text-white/75">
        <code>
          <span className="block">
            <span className="mr-3 inline-block w-2 text-right text-white/25 select-none">
              1
            </span>
            <span className="text-[#c4b5fd]">const</span> app ={" "}
            <span className="text-[#c4b5fd]">new</span> App();
          </span>
          <span className="block">
            <span className="mr-3 inline-block w-2 text-right text-white/25 select-none">
              2
            </span>
            app.build()
          </span>
          <span className="block">
            <span className="mr-3 inline-block w-2 text-right text-white/25 select-none">
              3
            </span>
            {"  "}.deploy()
          </span>
          <span className="block">
            <span className="mr-3 inline-block w-2 text-right text-white/25 select-none">
              4
            </span>
            {"  "}.scale();
          </span>
        </code>
      </pre>
    </div>
  );
}

const beads = [
  { className: "top-[9%] left-[37%] size-2", delay: "-0.8s" },
  { className: "top-[22%] right-[15%] size-2.5", delay: "-2.4s" },
  { className: "top-[58%] left-[13%] size-4", delay: "-1.2s" },
  { className: "top-[64%] right-[19%] size-2", delay: "-3.2s" },
  { className: "bottom-[7%] left-[46%] size-2.5", delay: "-4.1s" },
] as const;

/**
 * The hero artwork: a dark, glossy product orb ringed by fine orbits, with
 * capability cards floating in front. Everything is markup — no hero image to
 * download, nothing to upscale, and it adapts to dark mode and reduced motion.
 * It is decorative, so the whole composition is hidden from assistive tech.
 */
export function HeroVisual() {
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-[6/5] w-full max-w-[34rem] sm:aspect-[6/5.4] xl:aspect-auto xl:h-[35rem] xl:max-w-none"
    >
      <div className="absolute top-1/2 left-1/2 size-[94%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(96,64,244,0.14),transparent_72%)] blur-2xl dark:bg-[radial-gradient(closest-side,rgba(120,86,255,0.22),transparent_72%)]" />

      <svg
        viewBox="0 0 600 560"
        fill="none"
        className="pointer-events-none absolute inset-0 z-[12] h-full w-full"
      >
        <defs>
          <linearGradient
            id="hero-orbit-line"
            x1="90"
            y1="120"
            x2="540"
            y2="430"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8f7bff" stopOpacity="0" />
            <stop offset="0.25" stopColor="#8f7bff" stopOpacity="0.55" />
            <stop offset="0.7" stopColor="#c4b5fd" stopOpacity="0.28" />
            <stop offset="1" stopColor="#8f7bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="hero-orbit-line-2"
            x1="120"
            y1="420"
            x2="520"
            y2="150"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8f7bff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#a78bfa" stopOpacity="0.45" />
            <stop offset="1" stopColor="#8f7bff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse
          cx="300"
          cy="272"
          rx="288"
          ry="172"
          transform="rotate(-14 300 272)"
          stroke="url(#hero-orbit-line)"
          strokeWidth="1.1"
          strokeDasharray="1 9"
          strokeLinecap="round"
          className="hero-orbit"
        />
        <ellipse
          cx="300"
          cy="268"
          rx="238"
          ry="120"
          transform="rotate(17 300 268)"
          stroke="url(#hero-orbit-line-2)"
          strokeWidth="1"
        />
        <ellipse
          cx="300"
          cy="262"
          rx="204"
          ry="86"
          transform="rotate(-34 300 262)"
          stroke="#a78bfa"
          strokeOpacity="0.3"
          strokeWidth="0.8"
        />
      </svg>

      <div className="absolute top-[47%] left-1/2 z-10 aspect-square w-[43%] -translate-x-1/2 -translate-y-1/2">
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

      <Sparkles className="text-primary/50 absolute top-[6%] left-[43%] z-[11] size-4" />
      <Sparkles className="text-primary/40 absolute right-[28%] bottom-[6%] z-[11] size-3" />

      <FloatingCard
        className="top-0 left-0 sm:top-[3%]"
        delay="-1.6s"
        icon={<Sparkles className="size-4" />}
        iconClassName="bg-primary/10 text-primary"
        title="AI workflow"
        description="Automate your business with AI agents."
      />
      <FloatingCard
        className="top-[16%] right-0 hidden sm:block"
        delay="-2.8s"
        icon={<BarChart3 className="size-4" />}
        iconClassName="bg-primary text-primary-foreground"
        title="SaaS dashboard"
        description="Scalable, secure and built for growth."
      />
      <FloatingCard
        className="bottom-[20%] left-0 hidden xl:block xl:pb-16"
        delay="-4.2s"
        icon={<Code2 className="size-4" />}
        iconClassName="bg-primary/10 text-primary"
        title="Clean code"
        description="Modern, maintainable and scalable."
      />
      <FloatingCard
        className="right-0 bottom-0 hidden sm:bottom-[12%] sm:block"
        delay="-2.2s"
        icon={<Check className="size-4" />}
        iconClassName="bg-[#0ca30c]/10 text-[#0ca30c]"
        title="Deploy successful"
        description="Your product is live and ready to scale."
      />
      <CodeCard />
    </div>
  );
}
