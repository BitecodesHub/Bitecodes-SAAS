/**
 * Browser-side queue for the first-party analytics beacon.
 *
 * The queue exists so a burst of interaction events becomes one small request
 * instead of a request per click. It is deliberately tiny and dependency-free:
 * every marketing page loads it, and it must not affect LCP.
 *
 * Privacy rules enforced here as well as on the server:
 *  - Nothing is queued when Do Not Track or Global Privacy Control is on.
 *  - No cookies, no analytics storage writes (the site's first-touch
 *    attribution record is managed separately), no third-party requests.
 *  - Only the path is sent, never the query string. Campaign values come from
 *    the already-sanitised first-touch attribution record.
 */

import { isWebVitalName } from "@/lib/analytics";

export type AnalyticsClientEventType = "pageview" | "event" | "vital";

export interface AnalyticsClientUtm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
}

export interface AnalyticsClientEvent {
  type: AnalyticsClientEventType;
  path: string;
  name?: string;
  value?: number;
  referrerHost?: string | null;
  utm?: AnalyticsClientUtm | null;
  ts?: number;
}

export interface AnalyticsContext {
  path: string;
  referrerHost: string | null;
  utm: AnalyticsClientUtm | null;
}

const ENDPOINT = "/api/analytics";
/** Mirrors the server's batch ceiling. */
export const ANALYTICS_BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 4_000;
const MAX_NAME_LENGTH = 80;
const MAX_PATH_LENGTH = 200;
/** Mirrors the collector's body ceiling, with enough room for the envelope. */
const MAX_BODY_BYTES = 15_500;
/** Mirrors the collector's numeric bounds so one bad value cannot sink a batch. */
const MAX_EVENT_VALUE = 1_000_000_000;

let queue: AnalyticsClientEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let configuredPath: string | null = null;
let referrerHost: string | null = null;
let campaign: AnalyticsClientUtm | null = null;

/** True when the visitor has asked not to be measured. */
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return false;
  if (nav.doNotTrack === "1") return false;
  const legacy = (window as Window & { doNotTrack?: string | null }).doNotTrack;
  if (legacy === "1" || legacy === "yes") return false;
  return true;
}

/**
 * Turns a `data-track` value into a stable event name. Humans write these
 * attributes, so spaces and punctuation are normalised rather than causing the
 * whole event to be dropped.
 */
export function cleanEventName(value: string): string | null {
  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_NAME_LENGTH);
  return normalised || null;
}

function cleanPath(value: string): string | null {
  if (!value.startsWith("/")) return null;
  const bare = value.split(/[?#]/)[0] ?? "";
  if (!bare || bare.includes("@")) return null;
  return bare.slice(0, MAX_PATH_LENGTH);
}

function browserPath(): string | null {
  if (typeof window === "undefined") return null;
  return cleanPath(window.location.pathname);
}

/**
 * Records the current route and first-touch attribution for subsequent
 * events. Called by the beacon on mount and on every route change.
 */
export function configureAnalytics(context: AnalyticsContext): void {
  configuredPath = cleanPath(context.path);
  referrerHost = context.referrerHost;
  campaign = context.utm;
}

function utmFromAttribution(
  utm: AnalyticsClientUtm | null,
): AnalyticsClientUtm | null {
  if (!utm) return null;
  const { source, medium, campaign: name, term, content } = utm;
  if (!source && !medium && !name && !term && !content) return null;
  return { source, medium, campaign: name, term, content };
}

/** Converts a first-touch attribution record into the queue's UTM shape. */
export function clientUtm(
  attribution: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
  } | null,
): AnalyticsClientUtm | null {
  if (!attribution) return null;
  return utmFromAttribution({
    source: attribution.utmSource,
    medium: attribution.utmMedium,
    campaign: attribution.utmCampaign,
    term: attribution.utmTerm,
    content: attribution.utmContent,
  });
}

function bodyBytes(events: readonly AnalyticsClientEvent[]): number {
  return new Blob([JSON.stringify({ events })]).size;
}

function enqueue(event: AnalyticsClientEvent): void {
  // A batch of maximal UTM strings can exceed the collector's 16KB ceiling
  // before it reaches twenty events, so size is checked alongside count.
  if (
    queue.length > 0 &&
    (queue.length >= ANALYTICS_BATCH_SIZE ||
      bodyBytes([...queue, event]) > MAX_BODY_BYTES)
  ) {
    flushAnalytics();
  }
  queue.push(event);

  if (queue.length >= ANALYTICS_BATCH_SIZE) {
    flushAnalytics();
    return;
  }

  if (flushTimer === null) {
    flushTimer = setTimeout(flushAnalytics, FLUSH_DELAY_MS);
  }
}

/** Sends a page view for the current route. */
export function trackPageview(path?: string): void {
  if (!analyticsAllowed()) return;
  const clean = cleanPath(path ?? configuredPath ?? browserPath() ?? "");
  if (!clean) return;

  enqueue({
    type: "pageview",
    path: clean,
    // The server treats these as optional. Sending null is honest: this page
    // view had no external referrer or campaign rather than an unknown one.
    referrerHost,
    utm: campaign,
    ts: Date.now(),
  });
}

/**
 * Records a named interaction. This is the helper components import:
 *
 *     import { track } from "@/lib/analytics-client";
 *     track("pricing_plan_selected", plan.price);
 */
export function track(name: string, value?: number): void {
  if (!analyticsAllowed()) return;
  const clean = cleanEventName(name);
  if (!clean) return;

  const event: AnalyticsClientEvent = {
    type: "event",
    path: configuredPath ?? browserPath() ?? "/",
    name: clean,
    ts: Date.now(),
  };
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -MAX_EVENT_VALUE &&
    value <= MAX_EVENT_VALUE
  ) {
    event.value = value;
  }
  enqueue(event);
}

/** Reports one Web Vital. Unknown names are ignored rather than coerced. */
export function trackVital(name: string, value: number, path?: string): void {
  if (!analyticsAllowed()) return;
  if (!Number.isFinite(value) || value < 0 || value > MAX_EVENT_VALUE) return;
  const normalized = name.trim().toUpperCase();
  if (!isWebVitalName(normalized)) return;
  const clean = cleanPath(path ?? configuredPath ?? browserPath() ?? "");
  if (!clean) return;

  enqueue({
    type: "vital",
    path: clean,
    name: normalized,
    value,
    ts: Date.now(),
  });
}

/**
 * Sends everything queued, preferring `sendBeacon` so an in-flight batch
 * survives the page being hidden or unloaded. The fetch fallback uses
 * `keepalive` for the same reason.
 */
export function flushAnalytics(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const events = queue;
  queue = [];
  if (events.length === 0) return;
  if (typeof window === "undefined") return;

  const body = JSON.stringify({ events });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Some privacy extensions replace sendBeacon with a throwing stub. Fall
    // through to fetch rather than losing the batch.
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {
      // Analytics is best-effort. A blocked request must never surface.
    });
  } catch {
    // Same reasoning: a failed report is not a page error.
  }
}
