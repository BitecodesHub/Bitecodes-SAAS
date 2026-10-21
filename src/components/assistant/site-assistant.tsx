"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The website assistant (chat with lead capture and booking hand-off).
 *
 * Mounted in `src/app/(site)/layout.tsx`. Provides a floating chat widget
 * that streams responses through the automation chain with desktop gateway
 * fallbacks, captures leads, and offers booking hand-off.
 */
export function SiteAssistant() {
  const router = useRouter();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.onload = () => {
      const widget = (window as { bitecodesAssistant?: { init: () => void } })
        .bitecodesAssistant;
      if (widget?.init) {
        widget.init();
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [router]);

  return null;
}
