"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "motion/react";
import type { Stat } from "@/types/content";

function useCountUp(target: number, active: boolean, duration = 1400) {
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    // Reduced motion shows the final value directly (see return below); only
    // the animated path needs an effect.
    if (!active || reduce) return;
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
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration, reduce]);

  return reduce ? target : value;
}

export function StatCounter({ stat }: { stat: Stat }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const value = useCountUp(stat.value, inView);

  return (
    <div ref={ref} className="flex flex-col">
      <span className="text-5xl font-semibold tracking-[-0.03em] tabular-nums sm:text-6xl">
        <span className="text-gradient">
          {stat.prefix}
          {value}
          {stat.suffix}
        </span>
      </span>
      <span className="text-muted-foreground mt-2 text-sm">{stat.label}</span>
    </div>
  );
}
