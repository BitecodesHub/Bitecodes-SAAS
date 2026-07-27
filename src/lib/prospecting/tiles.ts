/**
 * Web Mercator tile arithmetic for the discovery map.
 *
 * The map is hand-rolled rather than delegated to Leaflet or MapLibre, for two
 * reasons. The obvious one is weight: the admin panel needs pan, zoom, one
 * draggable centre pin, a radius circle, and a few hundred markers — a fraction
 * of what a mapping library carries, and it would be the only runtime
 * dependency this feature added. The better one is that all the arithmetic that
 * can actually be wrong lives here, in pure functions, where it is unit-tested
 * against known reference values instead of trusted.
 *
 * Conventions, fixed by the OSM/Google tile scheme:
 * - Tile size is 256 px.
 * - Tile (0,0) is the north-west corner; y grows southward.
 * - At zoom `z` there are `2^z` tiles per axis.
 * - Latitude is clamped to ±85.0511°, the Mercator projection's limit.
 */

export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;

/** The latitude where Mercator y goes to infinity. */
export const MAX_LATITUDE = 85.05112878;

/** WGS-84 equatorial circumference, used for the metres-per-pixel scale. */
const EARTH_CIRCUMFERENCE_METERS = 40_075_016.686;

export interface Point {
  x: number;
  y: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM);
}

export function clampLatitude(lat: number): number {
  return clamp(lat, -MAX_LATITUDE, MAX_LATITUDE);
}

/**
 * Normalises longitude into [-180, 180).
 *
 * Dragging east past the antimeridian produces longitudes above 180; without
 * wrapping, the tile index would run off the edge of the world and the map would
 * go blank rather than continuing round.
 */
export function wrapLongitude(lng: number): number {
  if (!Number.isFinite(lng)) return 0;
  const wrapped = (((lng + 180) % 360) + 360) % 360;
  return wrapped - 180;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/** Fractional world pixel coordinates at a zoom level. */
export function project({ lat, lng }: LatLng, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const clampedLat = clampLatitude(lat);
  const sin = Math.sin((clampedLat * Math.PI) / 180);

  return {
    x: ((wrapLongitude(lng) + 180) / 360) * scale,
    // The standard Mercator y, expressed with atanh for numerical stability
    // near the poles compared with the log(tan(...)) form.
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** The inverse of `project`. */
export function unproject({ x, y }: Point, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI * (1 - (2 * y) / scale);

  return {
    lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI,
    lng: wrapLongitude(lng),
  };
}

/**
 * Ground resolution in metres per pixel.
 *
 * Scaled by cos(latitude) because Mercator stretches distances away from the
 * equator: the same pixel covers far less ground in Reykjavík than in Nairobi.
 * The radius circle would be wrong everywhere but the equator without this.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  return (
    (EARTH_CIRCUMFERENCE_METERS *
      Math.cos((clampLatitude(lat) * Math.PI) / 180)) /
    (TILE_SIZE * 2 ** zoom)
  );
}

/** Pixel radius for a ground distance at a given centre and zoom. */
export function metersToPixels(
  meters: number,
  lat: number,
  zoom: number,
): number {
  const resolution = metersPerPixel(lat, zoom);
  return resolution > 0 ? meters / resolution : 0;
}

export function pixelsToMeters(
  pixels: number,
  lat: number,
  zoom: number,
): number {
  return pixels * metersPerPixel(lat, zoom);
}

// ---------------------------------------------------------------------------
// Screen placement
// ---------------------------------------------------------------------------

/**
 * Where a coordinate lands on screen, given the viewport centre and size.
 *
 * Returns fractional pixels relative to the viewport's top-left, so the caller
 * positions an absolutely-placed element with no further arithmetic.
 */
export function latLngToScreen(
  target: LatLng,
  center: LatLng,
  zoom: number,
  viewport: { width: number; height: number },
): Point {
  const targetPoint = project(target, zoom);
  const centerPoint = project(center, zoom);
  const scale = TILE_SIZE * 2 ** zoom;

  let dx = targetPoint.x - centerPoint.x;
  // Take the shorter way round the world, so a marker just east of the
  // antimeridian appears beside the centre rather than a world away.
  if (dx > scale / 2) dx -= scale;
  if (dx < -scale / 2) dx += scale;

  return {
    x: viewport.width / 2 + dx,
    y: viewport.height / 2 + (targetPoint.y - centerPoint.y),
  };
}

/** The inverse: what coordinate a click at a viewport position refers to. */
export function screenToLatLng(
  position: Point,
  center: LatLng,
  zoom: number,
  viewport: { width: number; height: number },
): LatLng {
  const centerPoint = project(center, zoom);
  return unproject(
    {
      x: centerPoint.x + (position.x - viewport.width / 2),
      y: centerPoint.y + (position.y - viewport.height / 2),
    },
    zoom,
  );
}

/**
 * Recentres the map after a drag of `dx, dy` screen pixels.
 *
 * Vertical movement is clamped rather than wrapped: dragging past the pole must
 * stop, whereas dragging east must continue round the world.
 */
export function panCenter(
  center: LatLng,
  dx: number,
  dy: number,
  zoom: number,
): LatLng {
  const point = project(center, zoom);
  const scale = TILE_SIZE * 2 ** zoom;
  const moved = unproject(
    { x: point.x - dx, y: clamp(point.y - dy, 0, scale) },
    zoom,
  );
  return { lat: clampLatitude(moved.lat), lng: moved.lng };
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export interface TileRef {
  x: number;
  y: number;
  z: number;
  /** Screen position of this tile's top-left corner. */
  left: number;
  top: number;
  /** Stable key for React, including the unwrapped column. */
  key: string;
}

/**
 * Every tile needed to cover the viewport, with its screen position.
 *
 * `x` is wrapped into range so panning across the antimeridian keeps requesting
 * valid tiles, while the React key keeps the unwrapped column number so two
 * copies of the same tile on screen do not collide. Rows outside the world are
 * dropped — there is nothing above the north pole to draw.
 */
export function visibleTiles(
  center: LatLng,
  zoom: number,
  viewport: { width: number; height: number },
  /** Extra ring of tiles fetched outside the viewport, to hide pan seams. */
  padding = 1,
): TileRef[] {
  const z = clampZoom(zoom);
  const tilesPerAxis = 2 ** z;
  const centerPoint = project(center, z);

  const originX = centerPoint.x - viewport.width / 2;
  const originY = centerPoint.y - viewport.height / 2;

  const firstColumn = Math.floor(originX / TILE_SIZE) - padding;
  const lastColumn =
    Math.floor((originX + viewport.width) / TILE_SIZE) + padding;
  const firstRow = Math.floor(originY / TILE_SIZE) - padding;
  const lastRow = Math.floor((originY + viewport.height) / TILE_SIZE) + padding;

  const tiles: TileRef[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    if (row < 0 || row >= tilesPerAxis) continue;
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      tiles.push({
        x: ((column % tilesPerAxis) + tilesPerAxis) % tilesPerAxis,
        y: row,
        z,
        left: Math.round(column * TILE_SIZE - originX),
        top: Math.round(row * TILE_SIZE - originY),
        key: `${z}/${column}/${row}`,
      });
    }
  }

  return tiles;
}

/**
 * Fills a tile URL template.
 *
 * Only `{z}`, `{x}`, `{y}`, and the optional `{s}` subdomain are substituted —
 * the template comes from settings, and a blind `replace` of arbitrary
 * placeholders would let a stored value reach into other parts of the URL.
 */
export function tileUrl(
  template: string,
  tile: { x: number; y: number; z: number },
  subdomains = ["a", "b", "c"],
): string {
  const subdomain =
    subdomains[Math.abs(tile.x + tile.y) % subdomains.length] ?? "a";
  return template
    .replace("{s}", subdomain)
    .replace("{z}", String(tile.z))
    .replace("{x}", String(tile.x))
    .replace("{y}", String(tile.y));
}

/**
 * The zoom level at which a radius fills a comfortable share of the viewport.
 *
 * Used after a place search so the map frames the search area rather than
 * leaving the operator to zoom by hand.
 */
export function zoomForRadius(
  radiusMeters: number,
  lat: number,
  viewport: { width: number; height: number },
  /** Fraction of the smaller viewport dimension the diameter should occupy. */
  fill = 0.7,
): number {
  const smaller = Math.min(viewport.width, viewport.height);
  if (smaller <= 0 || radiusMeters <= 0) return 14;

  const targetPixels = (smaller * fill) / 2;
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    if (metersToPixels(radiusMeters, lat, zoom) <= targetPixels) return zoom;
  }
  return MIN_ZOOM;
}

/** Great-circle distance in metres, for "is this pin inside the circle?". */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const RADIUS = 6_371_008.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;

  return 2 * RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}
