/**
 * First-touch marketing attribution, captured in the browser.
 *
 * Records how a visitor first arrived — the `utm_*` campaign parameters, the
 * referring site's host, and the landing path — so a lead captured later can
 * say which channel produced it. Client-safe: no server imports.
 *
 * Privacy rules, enforced here rather than trusted to callers:
 *  - Never personal data. Only the referrer's host is kept (never its path or
 *    query), the landing path drops its query string, and any value that looks
 *    like an email address is discarded.
 *  - Stored only in this browser's localStorage. Every storage access is
 *    wrapped in try/catch, because private windows and blocked site data make
 *    it throw, and attribution must never break a page.
 *  - First touch wins: once stored, later visits do not overwrite it.
 */

export interface Attribution {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  /** Host of the referring site, e.g. "www.google.com". Null when direct. */
  referrerHost: string | null;
  /** Path of the first page seen, without query or fragment. */
  landingPath: string | null;
  /** ISO timestamp of the first visit. */
  firstSeenAt: string;
}

export const ATTRIBUTION_STORAGE_KEY = "bc_attribution_v1";

const UTM_FIELDS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
] as const;

const MAX_VALUE_LENGTH = 100;
const MAX_PATH_LENGTH = 200;

/**
 * Cleans one attribution value: trimmed, bounded, printable, and never
 * something that looks like an email address or a phone number.
 */
export function cleanAttributionValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;
  // Seven or more digits in a row is more likely a phone number than a campaign.
  if (/\d{7,}/.test(trimmed.replace(/[\s()+-]/g, ""))) return null;
  if (!/^[\p{L}\p{N} ._~+:/|,-]+$/u.test(trimmed)) return null;
  return trimmed;
}

/** The host of a referrer URL, or null when absent, invalid, or same-site. */
export function referrerHostOf(
  referrer: string | null | undefined,
  ownHost?: string | null,
): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!host) return null;
    if (ownHost && sameSite(host, ownHost.toLowerCase())) return null;
    return host.slice(0, MAX_VALUE_LENGTH);
  } catch {
    return null;
  }
}

function sameSite(a: string, b: string): boolean {
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a) === strip(b);
}

/** A path only: no query, no fragment, bounded. */
export function cleanLandingPath(
  path: string | null | undefined,
): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  const bare = path.split(/[?#]/)[0] ?? "";
  if (!bare || bare.includes("@")) return null;
  return bare.slice(0, MAX_PATH_LENGTH);
}

/**
 * Builds an attribution record from the parts of a page visit. Pure, so it is
 * unit-tested without a browser.
 */
export function parseAttribution(input: {
  search: string;
  referrer: string | null;
  pathname: string;
  host: string | null;
  now?: Date;
}): Attribution {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(input.search);
  } catch {
    params = new URLSearchParams();
  }
  const result: Attribution = {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    referrerHost: referrerHostOf(input.referrer, input.host),
    landingPath: cleanLandingPath(input.pathname),
    firstSeenAt: (input.now ?? new Date()).toISOString(),
  };
  for (const [param, field] of UTM_FIELDS) {
    result[field] = cleanAttributionValue(params.get(param));
  }
  return result;
}

/**
 * Validates an attribution object received from anywhere untrusted (a stored
 * value, a form submission). Returns a cleaned copy, or null when the input
 * is not an attribution record.
 */
export function sanitizeAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const firstSeen =
    typeof raw.firstSeenAt === "string" ? new Date(raw.firstSeenAt) : null;
  const result: Attribution = {
    utmSource: cleanAttributionValue(raw.utmSource),
    utmMedium: cleanAttributionValue(raw.utmMedium),
    utmCampaign: cleanAttributionValue(raw.utmCampaign),
    utmTerm: cleanAttributionValue(raw.utmTerm),
    utmContent: cleanAttributionValue(raw.utmContent),
    referrerHost:
      typeof raw.referrerHost === "string" &&
      /^[a-z0-9.-]{1,100}$/i.test(raw.referrerHost)
        ? raw.referrerHost.toLowerCase()
        : null,
    landingPath: cleanLandingPath(
      typeof raw.landingPath === "string" ? raw.landingPath : null,
    ),
    firstSeenAt:
      firstSeen && !Number.isNaN(firstSeen.getTime())
        ? firstSeen.toISOString()
        : new Date(0).toISOString(),
  };
  return result;
}

/** The minimal storage surface used, so tests can inject a fake. */
export interface AttributionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): AttributionStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored first-touch attribution, or null. Never throws. */
export function readAttribution(
  storage: AttributionStorage | null = browserStorage(),
): Attribution | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeAttribution(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Records first-touch attribution for this visit if none is stored yet, and
 * returns the stored (first-touch) record. Safe to call on every page view.
 * Returns null outside a browser. Never throws.
 */
export function captureAttribution(
  options: {
    storage?: AttributionStorage | null;
    location?: { search: string; pathname: string; host: string } | null;
    referrer?: string | null;
    now?: Date;
  } = {},
): Attribution | null {
  const storage =
    options.storage === undefined ? browserStorage() : options.storage;
  const existing = readAttribution(storage);
  if (existing) return existing;

  let location = options.location ?? null;
  let referrer = options.referrer ?? null;
  if (!location) {
    try {
      if (typeof window === "undefined") return null;
      location = {
        search: window.location.search,
        pathname: window.location.pathname,
        host: window.location.hostname,
      };
      referrer = options.referrer ?? document.referrer ?? null;
    } catch {
      return null;
    }
  }

  const attribution = parseAttribution({
    search: location.search,
    pathname: location.pathname,
    host: location.host,
    referrer,
    now: options.now,
  });

  if (storage) {
    try {
      storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    } catch {
      // Storage full or blocked: the in-memory record is still returned.
    }
  }
  return attribution;
}
