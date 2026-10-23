"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Sticky mobile CTA bar.
 *
 * Visible only on small screens (below md breakpoint) after the user has
 * scrolled 200px. Sits at the bottom of the viewport, full-width.
 *
 * On mount the bar measures its own height and writes it to the
 * `--sticky-cta-height` CSS custom property on <html>. Floating buttons
 * (WhatsApp, site assistant) that are positioned bottom-right should read
 * this variable and add it to their own bottom offset so they are never
 * obscured:
 *
 *   style={{ bottom: 'calc(1.5rem + var(--sticky-cta-height, 0px))' }}
 *
 * The bar only renders in the DOM after the scroll threshold is crossed, so
 * the property stays 0px when the bar is hidden.
 */
export function StickyCTABar() {
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Initialise to 0px immediately so floating buttons never start in the wrong
  // position before the scroll listener fires.
  useEffect(() => {
    document.documentElement.style.setProperty("--sticky-cta-height", "0px");
  }, []);

  useEffect(() => {
    const THRESHOLD = 200;

    function onScroll() {
      setVisible(window.scrollY > THRESHOLD);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Run once on mount in case the page loaded mid-scroll.
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Update --sticky-cta-height whenever visibility changes.
  useEffect(() => {
    const root = document.documentElement;
    if (visible && barRef.current) {
      const height = barRef.current.getBoundingClientRect().height;
      root.style.setProperty("--sticky-cta-height", `${height}px`);
    } else {
      root.style.setProperty("--sticky-cta-height", "0px");
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      role="complementary"
      aria-label="Quick actions"
      className="glass border-border/50 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex items-stretch gap-2 px-3 py-2.5">
        <Link
          href="/website-audit"
          data-track="sticky_audit_cta"
          className="text-foreground bg-surface-2 hover:bg-accent focus-visible:outline-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Free website audit
        </Link>
        <Link
          href="/book-a-call"
          data-track="sticky_call_cta"
          className="text-primary-foreground bg-primary hover:bg-primary/90 focus-visible:outline-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Book a call
        </Link>
      </div>
    </div>
  );
}
