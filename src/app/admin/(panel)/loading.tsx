/**
 * The skeleton shown while an admin page renders.
 *
 * This is the perceived-latency fix, and it is worth more than most of the
 * measured ones. Without a `loading.tsx`, a click on a sidebar link left the
 * *previous* page on screen until the next one had fully rendered — no spinner,
 * no skeleton, no acknowledgement of the click at all. Even a fast render reads
 * as a broken button when nothing responds to it, which is a large part of why
 * the panel "felt slow" while warm server time was about 0.1s.
 *
 * Deliberately no data, no `cookies()`, no session read: this file has to be
 * renderable before any of that resolves, or it cannot serve its purpose. It also
 * sits inside the panel layout, so the nav and the user's chrome stay put and only
 * the content region swaps — which is why it uses the same vertical rhythm
 * (`space-y-6`) and heading sizes as the real pages rather than a generic spinner.
 *
 * Note what this does NOT do: `loading.js` does not wrap the layout in the same
 * segment, and the panel layout awaits the session, the user record, and cookies.
 * So a *hard* navigation to /admin still blocks on those before anything paints.
 * This helps every click once the panel is open, which is where the complaint was.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-muted animate-pulse rounded-md ${className}`}
      // Decorative: the surrounding region is already announced as busy, and
      // announcing each bar would flood a screen reader with noise.
      aria-hidden="true"
    />
  );
}

export default function AdminLoading() {
  return (
    // `aria-busy` plus a polite live region: a screen-reader user gets one
    // "Loading" rather than a silent gap or a torrent of placeholder nodes.
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Page heading */}
      <div className="space-y-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-full max-w-xl" />
      </div>

      {/* Stat tiles — four, matching the widest grid the real pages use, so the
          layout does not jump when the content arrives. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border bg-card space-y-3 rounded-2xl border p-5"
          >
            <Bar className="h-3.5 w-24" />
            <Bar className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Table or list body */}
      <div className="border-border bg-card space-y-4 rounded-2xl border p-5">
        <Bar className="h-4 w-32" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Bar className="h-4 flex-1" />
            <Bar className="hidden h-4 w-28 sm:block" />
            <Bar className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
