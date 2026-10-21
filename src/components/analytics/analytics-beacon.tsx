"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { captureAttribution } from "@/lib/attribution";
import { isWebVitalName } from "@/lib/analytics";
import {
  analyticsAllowed,
  clientUtm,
  configureAnalytics,
  flushAnalytics,
  track,
  trackPageview,
  trackVital,
} from "@/lib/analytics-client";

/**
 * First-party, cookieless page-view, event, and Web Vitals beacon.
 *
 * Mounted once in the marketing layout. It is a client island that renders
 * nothing, so every `(site)` route remains static: the only dynamic input is
 * `usePathname`, which is available during static rendering.
 *
 * Capture rules:
 *  - one page view per route change, with first-touch attribution attached;
 *  - clicks on any element carrying `data-track="name"`, plus a generic
 *    `cta_click` for tracked links and non-submit buttons so the funnel works
 *    without every component adopting a second attribute;
 *  - `form_start` on the first interaction with a `data-track-form` form and
 *    `form_submit` when it is submitted;
 *  - LCP, INP, CLS, FCP, and TTFB through Next's Web Vitals hook.
 *
 * Do Not Track and Global Privacy Control are checked before anything is
 * queued, and the server checks the request headers again.
 */
/**
 * Utility controls and navigation helpers are tracked interactions but not
 * conversion steps. The specific event still records them; the generic CTA
 * counter stays honest.
 */
const UTILITY_TRACK_NAME =
  /(?:^|[-_.])(?:back|copy|download|home|logo|menu|mute|nav|pause|play|previous|print|related|share|tab|toggle)(?:$|[-_.])/i;

function isCtaClick(element: Element, name: string): boolean {
  if (UTILITY_TRACK_NAME.test(name)) return false;
  if (element instanceof HTMLAnchorElement) return true;
  if (element instanceof HTMLButtonElement) return element.type !== "submit";
  return false;
}

export function AnalyticsBeacon() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const lastPathRef = useRef<string | null>(null);
  // One entry per form, so typing five fields does not send five form_start
  // events. Replaced on navigation because the forms belong to the new page.
  const startedForms = useRef<WeakSet<Element>>(new WeakSet());

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!analyticsAllowed()) return;

    const attribution = captureAttribution();
    configureAnalytics({
      path: pathname,
      referrerHost: attribution?.referrerHost ?? null,
      utm: clientUtm(attribution),
    });

    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    startedForms.current = new WeakSet();
    trackPageview(pathname);
  }, [pathname]);

  // The callback identity is stable on purpose: changing it makes the hook
  // re-report every metric it already knows about.
  const reportVital = useCallback((metric: { name: string; value: number }) => {
    if (!isWebVitalName(metric.name)) return;
    trackVital(metric.name, metric.value, pathRef.current);
  }, []);
  useReportWebVitals(reportVital);

  useEffect(() => {
    if (!analyticsAllowed()) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest("[data-track]");
      const name = element?.getAttribute("data-track");
      if (!element || !name) return;
      track(name);
      if (name !== "cta_click" && isCtaClick(element, name)) {
        track("cta_click");
      }
    };

    const markFormStart = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const form = target.closest("form[data-track-form]");
      if (!form) return;
      if (startedForms.current.has(form)) return;
      startedForms.current.add(form);
      track("form_start");
    };

    const onSubmit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("form[data-track-form]")) return;
      track("form_submit");
      // A submit often navigates immediately; do not wait for the timer.
      flushAnalytics();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAnalytics();
    };

    // Capture phase: a handler that calls preventDefault or stops propagation
    // must not make a CTA click disappear from the funnel.
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", markFormStart, true);
    document.addEventListener("change", markFormStart, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushAnalytics);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", markFormStart, true);
      document.removeEventListener("change", markFormStart, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushAnalytics);
      // Leaving the layout is the last chance to send what is queued.
      flushAnalytics();
    };
  }, []);

  return null;
}
