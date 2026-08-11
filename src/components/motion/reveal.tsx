import * as React from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Retained for call-site compatibility; staggering is retired. */
  delay?: number;
  direction?: Direction;
  /** Render as a different element (e.g. "li", "span"). */
  as?: "div" | "li" | "span" | "section";
  once?: boolean;
}

/**
 * Fade/slide content into view on scroll — pure CSS, no JavaScript.
 *
 * The previous implementation used motion/react's `whileInView`, which
 * server-renders everything at `opacity: 0` and reveals it after hydration.
 * That meant blank sections for anyone without JavaScript, a hydration-sized
 * delay before content appeared, and animation work on the main thread.
 *
 * Now the element renders visible and, in browsers that support CSS
 * scroll-driven animations (`animation-timeline: view()`), plays a short
 * fade-rise as it enters the viewport. Elsewhere — and under
 * `prefers-reduced-motion` — content is simply visible. Server components can
 * use it directly; no client boundary required.
 */
export function Reveal({
  children,
  className,
  direction = "up",
  as: Tag = "div",
}: RevealProps) {
  return (
    <Tag className={cn(direction !== "none" && "reveal-in", className)}>
      {children}
    </Tag>
  );
}

/** Compatibility wrapper — grouping no longer orchestrates anything. */
export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/** Compatibility wrapper — each item reveals independently via CSS. */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("reveal-in", className)}>{children}</div>;
}
