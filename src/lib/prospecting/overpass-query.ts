import {
  getProspectCategory,
  normalizeCategoryIds,
  type OsmTagFilter,
} from "@/lib/prospecting/categories";

/**
 * Builds Overpass QL for a radius search.
 *
 * Overpass QL is a text language, so a category value reaching the query
 * unescaped would be an injection: `restaurant"]["foo"~"` would close the tag
 * test and append a filter of the attacker's choosing. Category ids come from
 * our own catalogue, but the ids arrive from a form, and defence in depth is
 * cheap — every key and value is validated against a strict character class and
 * a violation throws rather than being silently stripped.
 *
 * The other job of this module is to be a good citizen. Overpass is donated
 * infrastructure shared by the whole OSM ecosystem, so radius, result count, and
 * server-side timeout are all clamped here, in one place, instead of being
 * trusted to each caller.
 */

/** Keys are lowercase OSM tag keys, optionally namespaced with a colon. */
const SAFE_KEY = /^[a-z][a-z0-9_]*(:[a-z][a-z0-9_]*)*$/;
/** Values are OSM tag values: no quotes, no brackets, no backslashes. */
const SAFE_VALUE = /^[A-Za-z0-9_.:-]+$/;

export const RADIUS_LIMITS = { min: 100, max: 25_000, default: 2_000 } as const;
export const RESULT_LIMITS = { min: 1, max: 500, default: 200 } as const;
/**
 * Server-side budget. Overpass aborts the query itself once this is exceeded,
 * which returns a clean error instead of holding a connection open.
 */
export const QUERY_TIMEOUT_SECONDS = 45;

export interface OverpassQueryInput {
  lat: number;
  lng: number;
  radiusMeters: number;
  categoryIds: readonly string[];
  /** Maximum elements returned. Ignored in `count` mode. */
  limit?: number;
  /**
   * `elements` returns tags and a centre point per feature; `count` returns
   * only totals, which is what the live "≈N businesses" preview uses — it is
   * dramatically cheaper on the shared server than fetching and discarding.
   */
  mode?: "elements" | "count";
}

export function clampRadius(meters: number): number {
  if (!Number.isFinite(meters)) return RADIUS_LIMITS.default;
  return Math.min(
    RADIUS_LIMITS.max,
    Math.max(RADIUS_LIMITS.min, Math.round(meters)),
  );
}

export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return RESULT_LIMITS.default;
  return Math.min(
    RESULT_LIMITS.max,
    Math.max(RESULT_LIMITS.min, Math.round(limit)),
  );
}

/**
 * Formats a coordinate for the query.
 *
 * `toFixed(6)` rather than `String(n)` on purpose: a very small longitude such
 * as 0.0000004 stringifies to `4e-7`, and Overpass rejects exponent notation.
 * Six decimals is about 11 cm — far finer than any business footprint.
 */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function assertValidCoordinates(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Latitude out of range: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Longitude out of range: ${lng}`);
  }
}

function assertSafeFilter(filter: OsmTagFilter): void {
  if (!SAFE_KEY.test(filter.key)) {
    throw new Error(`Unsafe OSM tag key: ${filter.key}`);
  }
  for (const value of filter.values) {
    if (!SAFE_VALUE.test(value)) {
      throw new Error(`Unsafe OSM tag value: ${value}`);
    }
  }
}

/**
 * Renders one tag test.
 *
 * A single value uses equality, which lets Overpass use its tag index directly;
 * several values use an anchored regular expression. Anchoring matters — an
 * unanchored `~"restaurant"` would also match `restaurant_supply`.
 */
export function renderTagFilter(filter: OsmTagFilter): string {
  assertSafeFilter(filter);

  if (filter.values.length === 0) return `["${filter.key}"]`;
  if (filter.values.length === 1)
    return `["${filter.key}"="${filter.values[0]}"]`;
  return `["${filter.key}"~"^(${filter.values.join("|")})$"]`;
}

/**
 * Builds the full query.
 *
 * Every statement additionally requires `["name"]`: an unnamed feature cannot
 * be researched, addressed, or emailed, so it is not a prospect. Filtering
 * server-side keeps the response small rather than discarding rows locally.
 */
export function buildOverpassQuery({
  lat,
  lng,
  radiusMeters,
  categoryIds,
  limit = RESULT_LIMITS.default,
  mode = "elements",
}: OverpassQueryInput): string {
  assertValidCoordinates(lat, lng);

  const categories = normalizeCategoryIds(categoryIds);
  if (categories.length === 0) {
    throw new Error("At least one known category is required.");
  }

  const radius = clampRadius(radiusMeters);
  const around = `(around:${radius},${formatCoordinate(lat)},${formatCoordinate(lng)})`;

  const statements = categories.flatMap((id) => {
    const category = getProspectCategory(id);
    if (!category) return [];
    return category.filters.map(
      // `nwr` matches nodes, ways, and relations in one statement: a small café
      // is usually a node, a supermarket is usually a building way.
      (filter) => `  nwr${renderTagFilter(filter)}["name"]${around};`,
    );
  });

  // Always `[out:json]`. There is no `[out:count]` output format — Overpass
  // rejects it outright with a parse error — counting is `out count;` inside a
  // normal JSON query. (Verified against the live API; a unit test cannot catch
  // an invalid format name.)
  const header = `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}];`;

  // `body` verbosity, not `tags`: `tags` returns ids and tags but **no
  // coordinates for nodes**, and most small businesses are mapped as nodes — so
  // `out tags center` would silently discard nearly every result at the
  // normalisation step. `center` additionally gives ways and relations a
  // representative point without requesting full geometry.
  const footer =
    mode === "count" ? "out count;" : `out body center ${clampLimit(limit)};`;

  return [header, "(", ...statements, ");", footer].join("\n");
}

/**
 * A stable cache key for one search.
 *
 * Coordinates are rounded to ~11 m so that nudging the map pin by a metre
 * reuses the cached answer instead of hitting Overpass again. Categories are
 * normalised (so already in catalogue order) before joining.
 */
export function overpassCacheKey(input: OverpassQueryInput): string {
  const categories = normalizeCategoryIds(input.categoryIds);
  return [
    "overpass",
    input.mode ?? "elements",
    formatCoordinate(Number(input.lat.toFixed(4))),
    formatCoordinate(Number(input.lng.toFixed(4))),
    clampRadius(input.radiusMeters),
    clampLimit(input.limit ?? RESULT_LIMITS.default),
    categories.join(","),
  ].join("|");
}
