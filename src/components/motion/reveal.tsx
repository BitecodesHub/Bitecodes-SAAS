"use client";

import * as React from "react";
import { m, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger helper — multiplies a base delay. */
  delay?: number;
  direction?: Direction;
  /** Render as a different element (e.g. "li", "span"). */
  as?: "div" | "li" | "span" | "section";
  once?: boolean;
}

const offset = 24;

function getInitial(direction: Direction) {
  switch (direction) {
    case "up":
      return { opacity: 0, y: offset };
    case "down":
      return { opacity: 0, y: -offset };
    case "left":
      return { opacity: 0, x: offset };
    case "right":
      return { opacity: 0, x: -offset };
    default:
      return { opacity: 0 };
  }
}

/**
 * Fade/slide content into view on scroll. Disables motion automatically when
 * the user prefers reduced motion. Animation stays off the critical path.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  as = "div",
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = m[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={cn(className)}
      initial={getInitial(direction)}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: "0px 0px -10% 0px" }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}

/** Container that staggers direct Reveal children via CSS-free orchestration. */
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div className={className} variants={itemVariants}>
      {children}
    </m.div>
  );
}
