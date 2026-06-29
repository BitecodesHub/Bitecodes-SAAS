/**
 * Scroll progress bar driven entirely by CSS scroll-timeline (see globals.css)
 * — no JavaScript, no motion library on the critical path. Browsers without
 * scroll-timeline support simply do not show the bar (progressive enhancement).
 */
export function ScrollProgress() {
  return <div aria-hidden="true" className="scroll-progress" />;
}
