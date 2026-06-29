"use client";

import { domAnimation, LazyMotion } from "motion/react";

/**
 * Loads only the DOM animation feature set (lazily) and enforces use of the
 * lightweight `m` component everywhere, shipping a much smaller motion bundle
 * than the eager `motion` API.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
