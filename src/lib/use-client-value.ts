"use client";

import { useSyncExternalStore } from "react";

/**
 * Reads a value that only exists in the browser, without a hydration mismatch.
 *
 * The visitor's timezone is the motivating case: `Intl.DateTimeFormat()
 * .resolvedOptions().timeZone` answers one thing on the server and another in the
 * browser, so reading it during render puts one zone in the HTML and a different
 * one in the hydrated tree. React reports that as a mismatch and resolves it by
 * keeping the server's answer — the wrong one.
 *
 * The usual workaround is a mount effect that calls `setState`, which works but
 * triggers a second render on every mount and is exactly what
 * `react-hooks/set-state-in-effect` objects to. `useSyncExternalStore` is the API
 * built for this: it takes a distinct server snapshot, so the server renders the
 * fallback and the client renders the real value, deliberately and without a
 * mismatch being reported.
 *
 * The value must be stable between calls — returning a fresh object each time
 * would loop — so callers should produce a primitive.
 */
export function useClientValue<T>(read: () => T, serverFallback: T): T {
  return useSyncExternalStore(
    // Never changes after mount, so nothing ever needs to notify.
    subscribeToNothing,
    read,
    () => serverFallback,
  );
}

function subscribeToNothing(): () => void {
  return () => {};
}

/** The browser's IANA timezone, or a caller-supplied fallback during SSR. */
export function useVisitorTimezone(fallback = ""): string {
  return useClientValue(readTimezone, fallback);
}

function readTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
