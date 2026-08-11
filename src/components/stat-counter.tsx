"use client";

import * as React from "react";
import type { Stat } from "@/types/content";

/**
 * Count-up statistic. Plain IntersectionObserver + rAF — this was the last
 * motion/react consumer on the public site, and hand-rolling it let the whole
 * animation library leave the bundle. Reduced-motion users (and non-JS
 * renders) see the final value immediately: the server renders the target,
 * and the count-up only arms after hydration when motion is allowed.
 */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = React.useState(target);

  React.useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const progress = Math.min((t - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    // The first tick lands on progress 0 and renders 0, so no synchronous
    // reset is needed before the animation starts.
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}

export function StatCounter({ stat }: { stat: Stat }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const value = useCountUp(stat.value, inView);

  return (
    <div ref={ref} className="flex flex-col">
      <span className="text-5xl font-semibold tracking-[-0.03em] tabular-nums sm:text-6xl">
        {stat.prefix}
        {value}
        {stat.suffix}
      </span>
      <span className="text-muted-foreground mt-2 text-sm">{stat.label}</span>
    </div>
  );
}
