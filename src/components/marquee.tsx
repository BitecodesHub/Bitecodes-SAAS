import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Seamless horizontal marquee. Pure CSS animation, so it automatically
 * pauses for users who prefer reduced motion (see globals.css). The content
 * is duplicated once to create a continuous loop.
 */
export function Marquee({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mask-fade-x group relative overflow-hidden", className)}
    >
      <div className="animate-marquee flex w-max items-center group-hover:[animation-play-state:paused]">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
