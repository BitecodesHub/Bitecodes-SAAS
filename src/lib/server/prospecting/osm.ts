import "server-only";

import { discoveryCache } from "@/lib/server/db/collections";
import {
  getNominatimEndpoint,
  getOverpassEndpoint,
  getSiteUrl,
} from "@/lib/server/env";
import {
  buildOverpassQuery,
  overpassCacheKey,
  type OverpassQueryInput,
} from "@/lib/prospecting/overpass-query";
import type { OverpassElement } from "@/lib/prospecting/normalize";
import { HostThrottle } from "@/lib/server/prospecting/throttle";

/**
 * Clients for the two OpenStreetMap services this feature depends on:
 * Overpass (find businesses in an area) and Nominatim (turn a place name into
 * coordinates).
 *
 * Both are **donated infrastructure**, run for the OSM community rather than
 * sold. Their published usage policies require an identifying User-Agent, a
 * strict cap on parallelism, and caching so the same question is not asked
 * twice. Hammering them would get this application's IP blocked — and would
 * deserve it. Every one of those obligations is enforced here, in one module, so
 * no caller can accidentally bypass them:
 *
 * - **One request at a time**, process-wide, via a promise chain.
 * - **A minimum gap** between consecutive requests to the same service.
 * - **A shared 24-hour cache** in MongoDB, so a restart does not re-ask, and so
 *   several server instances share one answer.
 * - **An identifying User-Agent** with a contact URL, as both policies require.
 */

/** Nominatim's policy is an absolute maximum of 1 request per second. */
const NOMINATIM_MIN_INTERVAL_MS = 1_100;
/** Overpass has no published rate, but it does publish slot limits. */
const OVERPASS_MIN_INTERVAL_MS = 1_200;

/**
 * Must comfortably exceed the server-side `[timeout:45]` budget plus transfer
 * time, or this client aborts queries that were about to succeed — which is
 * indistinguishable from an outage and burns a mirror attempt for nothing.
 */
const OVERPASS_TIMEOUT_MS = 90_000;

const NOMINATIM_TIMEOUT_MS = 15_000;

/** Bound the response body so a hostile endpoint cannot exhaust memory. */
const MAX_RESPONSE_BYTES = 8_000_000;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** A failed lookup is cached briefly so a retry storm cannot form. */
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "RATE_LIMITED"
      /** This client gave up waiting. Worth trying a different endpoint. */
      | "CLIENT_TIMEOUT"
      /** The server abandoned the query as too expensive. Retrying will not help. */
      | "TIMEOUT"
      | "UNAVAILABLE"
      | "INVALID_RESPONSE"
      | "TOO_LARGE",
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// ---------------------------------------------------------------------------
// Throttle
// ---------------------------------------------------------------------------

declare global {
  var __bitecodesOverpassThrottle: HostThrottle | undefined;
  var __bitecodesNominatimThrottle: HostThrottle | undefined;
}

// Stored on the global so Next's dev-mode module reloading cannot hand out a
// fresh, un-throttled instance on every edit.
const overpassThrottle = (global.__bitecodesOverpassThrottle ??=
  new HostThrottle(OVERPASS_MIN_INTERVAL_MS));
const nominatimThrottle = (global.__bitecodesNominatimThrottle ??=
  new HostThrottle(NOMINATIM_MIN_INTERVAL_MS));

// ---------------------------------------------------------------------------
// Identification
// ---------------------------------------------------------------------------

/**
 * Both OSM services require a User-Agent that identifies the application and
 * offers a way to make contact. A generic library string is grounds for
 * blocking, so the site URL is embedded.
 */
function userAgent(): string {
  return `BitecodesProspecting/1.0 (+${getSiteUrl()})`;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const collection = await discoveryCache();
    const entry = await collection.findOne({ _id: key });
    // The TTL index does the deleting, but it runs about once a minute, so an
    // expired document can still be read. Check the timestamp too.
    if (!entry || entry.expiresAt.getTime() <= Date.now()) return undefined;
    return entry.payload as T;
  } catch {
    // A cache miss must never be fatal — fall through to the live request.
    return undefined;
  }
}

async function writeCache(
  key: string,
  provider: string,
  payload: unknown,
  ttlMs = CACHE_TTL_MS,
): Promise<void> {
  try {
    const collection = await discoveryCache();
    const now = new Date();
    await collection.updateOne(
      { _id: key },
      {
        $set: {
          provider,
          payload,
          createdAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      },
      { upsert: true },
    );
  } catch {
    // Caching is an optimisation; failing to cache is not a request failure.
  }
}

// ---------------------------------------------------------------------------
// Shared fetch
// ---------------------------------------------------------------------------

interface FetchTextOptions {
  url: string;
  method?: "GET" | "POST";
  body?: string;
  contentType?: string;
  timeoutMs: number;
  accept: string;
}

async function fetchText({
  url,
  method = "GET",
  body,
  contentType,
  timeoutMs,
  accept,
}: FetchTextOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      body,
      headers: {
        "User-Agent": userAgent(),
        Accept: accept,
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      signal: controller.signal,
      // These are cached deliberately in MongoDB; Next's fetch cache would key
      // on the URL alone and miss the POST body Overpass queries live in.
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(
        "The mapping service did not respond in time.",
        "CLIENT_TIMEOUT",
      );
    }
    throw new ProviderError(
      "The mapping service could not be reached.",
      "UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ProviderError(
      "The mapping service is rate limiting this application. Please try again shortly.",
      "RATE_LIMITED",
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60,
    );
  }

  // Overpass answers 504 for two very different reasons, and telling an
  // operator to narrow their search when the public server is simply
  // overloaded would send them chasing a problem they cannot fix. The body
  // distinguishes them: a dispatcher timeout is load, anything else is budget.
  if (response.status === 504) {
    const body = await response.text().catch(() => "");
    const overloaded = /too busy|Dispatcher_Client|rate_limited/i.test(body);
    throw new ProviderError(
      overloaded
        ? "The public OpenStreetMap query server is busy right now. This usually clears within a minute."
        : "The area or category list is too broad for the mapping service. Reduce the radius or pick fewer categories.",
      overloaded ? "UNAVAILABLE" : "TIMEOUT",
    );
  }

  if (!response.ok) {
    throw new ProviderError(
      `The mapping service returned ${response.status}.`,
      "UNAVAILABLE",
    );
  }

  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    throw new ProviderError(
      "The mapping service response was too large.",
      "TOO_LARGE",
    );
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new ProviderError(
      "The mapping service response was too large.",
      "TOO_LARGE",
    );
  }
  return text;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError(
      "The mapping service returned a malformed response.",
      "INVALID_RESPONSE",
    );
  }
}

// ---------------------------------------------------------------------------
// Overpass
// ---------------------------------------------------------------------------

/**
 * Public Overpass mirrors, tried in order after the configured endpoint.
 *
 * The main instance returns 504 under load often enough that a single-endpoint
 * client is unreliable in practice — observed directly while building this. One
 * fallback attempt is a fair use of a donated mirror; hammering a list of ten
 * would not be, which is why this is short and why only load-related failures
 * retry.
 */
const OVERPASS_FALLBACKS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** The configured endpoint first, then mirrors, with no duplicates. */
function overpassEndpoints(): string[] {
  const configured = getOverpassEndpoint();
  return [
    configured,
    ...OVERPASS_FALLBACKS.filter((url) => url !== configured),
  ];
}

/**
 * Which failures are worth trying on another endpoint.
 *
 * Load, rate limiting, and a stalled connection are all properties of *that*
 * server, so a mirror may well answer. A server-side budget timeout
 * (`TIMEOUT`) and a malformed query are properties of the *query*, and moving
 * them to a donated mirror would just waste someone else's capacity.
 */
function isRetryableProviderError(error: unknown): boolean {
  return (
    error instanceof ProviderError &&
    (error.code === "UNAVAILABLE" ||
      error.code === "RATE_LIMITED" ||
      error.code === "CLIENT_TIMEOUT")
  );
}

/**
 * Runs one Overpass query, falling back to a mirror when the first endpoint is
 * overloaded. A malformed query (`INVALID_RESPONSE`) or an over-budget one
 * (`TIMEOUT`) fails immediately — retrying those elsewhere would just move the
 * same failure to someone else's server.
 */
async function postOverpass(query: string): Promise<string> {
  const endpoints = overpassEndpoints();
  let lastError: unknown;

  for (const [index, endpoint] of endpoints.entries()) {
    try {
      return await overpassThrottle.run(() =>
        fetchText({
          url: endpoint,
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          contentType: "application/x-www-form-urlencoded",
          timeoutMs: OVERPASS_TIMEOUT_MS,
          accept: "application/json",
        }),
      );
    } catch (error) {
      lastError = error;
      const canRetry =
        index < endpoints.length - 1 && isRetryableProviderError(error);
      if (!canRetry) throw error;
      console.warn(
        `[overpass] ${endpoint} unavailable, trying a mirror:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError;
}

interface OverpassResponse {
  elements?: unknown;
  remark?: string;
}

export interface OverpassResult {
  elements: OverpassElement[];
  /** True when the answer came from the shared cache. */
  cached: boolean;
  /** Overpass's own warning text, e.g. a truncated result set. */
  remark: string | null;
}

/**
 * Runs a radius search and returns raw elements.
 *
 * Overpass is queried by POST with the query in the body: a long query in a URL
 * runs into length limits on intermediate proxies.
 */
export async function fetchOverpassElements(
  input: OverpassQueryInput,
): Promise<OverpassResult> {
  const key = overpassCacheKey(input);
  const cached = await readCache<OverpassResult>(key);
  if (cached) return { ...cached, cached: true };

  const text = await postOverpass(buildOverpassQuery(input));
  const payload = parseJson<OverpassResponse>(text);
  if (!Array.isArray(payload.elements)) {
    // Overpass reports server-side query errors in `remark` with HTTP 200.
    throw new ProviderError(
      payload.remark
        ? `The mapping service rejected the query: ${String(payload.remark).slice(0, 200)}`
        : "The mapping service returned no result set.",
      "INVALID_RESPONSE",
    );
  }

  const result: OverpassResult = {
    elements: payload.elements as OverpassElement[],
    cached: false,
    remark: typeof payload.remark === "string" ? payload.remark : null,
  };

  await writeCache(key, "overpass", result);
  return result;
}

/**
 * Counts matches without transferring them.
 *
 * Powers the live "≈N businesses in this area" preview, which would otherwise
 * download and discard a full result set on every slider movement.
 */
export async function countOverpassMatches(
  input: Omit<OverpassQueryInput, "mode">,
): Promise<{ total: number; cached: boolean }> {
  const countInput: OverpassQueryInput = { ...input, mode: "count" };
  const key = overpassCacheKey(countInput);
  const cached = await readCache<{ total: number }>(key);
  if (cached) return { total: cached.total, cached: true };

  const text = await postOverpass(buildOverpassQuery(countInput));
  const payload = parseJson<{
    elements?: Array<{ tags?: Record<string, string> }>;
  }>(text);
  const total = readCountTotal(payload);
  await writeCache(key, "overpass-count", { total });
  return { total, cached: false };
}

/**
 * Reads the total out of an `[out:count]` response.
 *
 * The shape is a single element whose `tags` carry stringified counts per
 * element type, so the total is the sum of nodes, ways, and relations rather
 * than the `total` field, which some endpoints omit.
 */
export function readCountTotal(payload: {
  elements?: Array<{ tags?: Record<string, string> }>;
}): number {
  const tags = payload.elements?.[0]?.tags ?? {};
  const explicit = Number(tags.total);
  if (Number.isFinite(explicit)) return explicit;

  return ["nodes", "ways", "relations"].reduce((sum, key) => {
    const value = Number(tags[key]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

// Liveness probing lives in `src/lib/server/admin/health.ts`, which already
// owns the Overpass status check for the dashboard panel. Two probes would
// double this application's footprint on a donated service for no gain.

// ---------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  /** Suggested radius from the place's own bounding box, in metres. */
  suggestedRadiusMeters: number;
  countryCode: string | null;
  type: string | null;
}

interface NominatimPlace {
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
  type?: string;
  address?: { country_code?: string };
}

/**
 * Turns a typed place name into coordinates and a sensible starting radius.
 *
 * The radius is derived from the place's bounding box, so searching "Navrangpura"
 * starts at neighbourhood scale while "Ahmedabad" starts at city scale. Guessing
 * a fixed radius instead would either return three results or thirty thousand.
 */
export async function geocodePlace(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (trimmed.length > 200) {
    throw new ProviderError("The search text is too long.", "INVALID_RESPONSE");
  }

  const bounded = Math.min(10, Math.max(1, Math.round(limit)));
  const key = `nominatim|search|${bounded}|${trimmed.toLowerCase()}`;
  const cached = await readCache<GeocodeResult[]>(key);
  if (cached) return cached;

  const url = new URL(`${getNominatimEndpoint()}/search`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(bounded));
  url.searchParams.set("addressdetails", "1");

  const text = await nominatimThrottle.run(() =>
    fetchText({
      url: url.toString(),
      timeoutMs: NOMINATIM_TIMEOUT_MS,
      accept: "application/json",
    }),
  );

  const places = parseJson<NominatimPlace[]>(text);
  if (!Array.isArray(places)) {
    throw new ProviderError(
      "The place-search service returned an unexpected response.",
      "INVALID_RESPONSE",
    );
  }

  const results = places.flatMap((place) => {
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [
      {
        label: (place.display_name ?? "Unnamed place").slice(0, 240),
        lat,
        lng,
        suggestedRadiusMeters: radiusFromBoundingBox(place.boundingbox),
        countryCode: place.address?.country_code?.toUpperCase() ?? null,
        type: place.type ?? null,
      },
    ];
  });

  // Cache the empty answer too, briefly — a typo retried ten times must not
  // become ten requests to a donated service.
  await writeCache(
    key,
    "nominatim",
    results,
    results.length > 0 ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS,
  );
  return results;
}

/**
 * Half the diagonal of the bounding box, clamped to something searchable.
 *
 * A country-sized box would otherwise suggest a 500 km radius, which Overpass
 * would refuse and which nobody wants to email anyway.
 */
export function radiusFromBoundingBox(
  boundingbox: string[] | undefined,
): number {
  const DEFAULT = 2_000;
  if (!boundingbox || boundingbox.length < 4) return DEFAULT;

  const [southText, northText, westText, eastText] = boundingbox;
  const south = Number(southText);
  const north = Number(northText);
  const west = Number(westText);
  const east = Number(eastText);
  if (![south, north, west, east].every(Number.isFinite)) return DEFAULT;

  const midLatitude = ((south + north) / 2) * (Math.PI / 180);
  const metresPerDegree = 111_320;
  const heightMeters = Math.abs(north - south) * metresPerDegree;
  const widthMeters =
    Math.abs(east - west) * metresPerDegree * Math.cos(midLatitude);

  const radius = Math.round(Math.hypot(heightMeters, widthMeters) / 2);
  // A point-like result — a single shop or a landmark — has a zero-area box.
  // Searching 300 m around it would return almost nothing, so the default
  // neighbourhood radius is the more useful starting point.
  if (radius <= 0) return DEFAULT;
  return Math.min(15_000, Math.max(300, radius));
}

/** Reverse geocode, so dropping a pin still names the city on the record. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{
  label: string;
  city: string | null;
  countryCode: string | null;
} | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const key = `nominatim|reverse|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  const cached = await readCache<{
    label: string;
    city: string | null;
    countryCode: string | null;
  }>(key);
  if (cached) return cached;

  const url = new URL(`${getNominatimEndpoint()}/reverse`);
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lng.toFixed(6));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");

  let text: string;
  try {
    text = await nominatimThrottle.run(() =>
      fetchText({
        url: url.toString(),
        timeoutMs: NOMINATIM_TIMEOUT_MS,
        accept: "application/json",
      }),
    );
  } catch {
    // A missing place label must not fail a discovery run.
    return null;
  }

  const place = parseJson<
    NominatimPlace & {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        suburb?: string;
        county?: string;
        country_code?: string;
      };
    }
  >(text);

  const address = place.address ?? {};
  const result = {
    label: (place.display_name ?? "Selected area").slice(0, 240),
    city:
      address.city ??
      address.town ??
      address.village ??
      address.suburb ??
      address.county ??
      null,
    countryCode: address.country_code?.toUpperCase() ?? null,
  };

  await writeCache(key, "nominatim-reverse", result);
  return result;
}
