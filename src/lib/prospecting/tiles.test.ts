import { describe, expect, it } from "vitest";
import {
  MAX_LATITUDE,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampLatitude,
  clampZoom,
  haversineMeters,
  latLngToScreen,
  metersPerPixel,
  metersToPixels,
  panCenter,
  pixelsToMeters,
  project,
  screenToLatLng,
  tileUrl,
  unproject,
  visibleTiles,
  wrapLongitude,
  zoomForRadius,
} from "@/lib/prospecting/tiles";

const AHMEDABAD = { lat: 23.0225, lng: 72.5714 };
const VIEWPORT = { width: 800, height: 600 };

describe("project / unproject", () => {
  it("places 0,0 at the centre of the world at zoom 0", () => {
    expect(project({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 });
  });

  it("places the west and east edges correctly", () => {
    expect(project({ lat: 0, lng: -180 }, 0).x).toBeCloseTo(0, 6);
    // +180 wraps to -180, which is the same meridian.
    expect(project({ lat: 0, lng: 180 }, 0).x).toBeCloseTo(0, 6);
  });

  it("matches the reference tile for Ahmedabad", () => {
    // 23.0225N 72.5714E at zoom 12 falls in tile 2873/1778 under the standard
    // OSM scheme: x = (lng+180)/360 * 2^z, y from the Mercator formula.
    const point = project(AHMEDABAD, 12);
    expect(Math.floor(point.x / TILE_SIZE)).toBe(2873);
    expect(Math.floor(point.y / TILE_SIZE)).toBe(1778);
  });

  it("round-trips through unproject", () => {
    for (const zoom of [0, 5, 12, 19]) {
      const result = unproject(project(AHMEDABAD, zoom), zoom);
      expect(result.lat).toBeCloseTo(AHMEDABAD.lat, 6);
      expect(result.lng).toBeCloseTo(AHMEDABAD.lng, 6);
    }
  });

  it("round-trips a southern-hemisphere point", () => {
    const sydney = { lat: -33.8688, lng: 151.2093 };
    const result = unproject(project(sydney, 14), 14);
    expect(result.lat).toBeCloseTo(sydney.lat, 6);
    expect(result.lng).toBeCloseTo(sydney.lng, 6);
  });

  it("doubles world size per zoom level", () => {
    expect(project({ lat: 0, lng: 90 }, 1).x).toBeCloseTo(
      project({ lat: 0, lng: 90 }, 0).x * 2,
      6,
    );
  });

  it("clamps latitude to the Mercator limit instead of producing infinity", () => {
    const north = project({ lat: 90, lng: 0 }, 4);
    expect(Number.isFinite(north.y)).toBe(true);
    expect(north.y).toBeCloseTo(project({ lat: MAX_LATITUDE, lng: 0 }, 4).y, 6);

    const south = project({ lat: -90, lng: 0 }, 4);
    expect(Number.isFinite(south.y)).toBe(true);
  });
});

describe("wrapLongitude", () => {
  it("leaves in-range values alone", () => {
    expect(wrapLongitude(72.5714)).toBeCloseTo(72.5714, 6);
    expect(wrapLongitude(-179)).toBeCloseTo(-179, 6);
  });

  it("wraps past the antimeridian", () => {
    expect(wrapLongitude(181)).toBeCloseTo(-179, 6);
    expect(wrapLongitude(-181)).toBeCloseTo(179, 6);
    // 540 is 180 after a full turn, which normalises to -180.
    expect(wrapLongitude(540)).toBe(-180);
  });

  it("normalises 180 to -180, the same meridian", () => {
    expect(wrapLongitude(180)).toBe(-180);
  });

  it("returns 0 for non-numbers", () => {
    expect(wrapLongitude(Number.NaN)).toBe(0);
  });
});

describe("clampZoom and clampLatitude", () => {
  it("clamps zoom to the supported range and rounds", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(12.6)).toBe(13);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });

  it("clamps latitude symmetrically", () => {
    expect(clampLatitude(90)).toBe(MAX_LATITUDE);
    expect(clampLatitude(-90)).toBe(-MAX_LATITUDE);
    expect(clampLatitude(23)).toBe(23);
  });
});

describe("metersPerPixel", () => {
  it("matches the known equator value at zoom 0", () => {
    // 40075016.686 / 256 ≈ 156543.03 m/px — the standard reference figure.
    expect(metersPerPixel(0, 0)).toBeCloseTo(156_543.03, 1);
  });

  it("halves with each zoom level", () => {
    expect(metersPerPixel(0, 10)).toBeCloseTo(metersPerPixel(0, 9) / 2, 6);
  });

  it("shrinks away from the equator", () => {
    // Mercator stretches distance with latitude; ignoring this would draw the
    // radius circle wrong everywhere but the equator.
    expect(metersPerPixel(60, 12)).toBeLessThan(metersPerPixel(0, 12));
    expect(metersPerPixel(60, 12)).toBeCloseTo(metersPerPixel(0, 12) * 0.5, 2);
  });

  it("is symmetric across the equator", () => {
    expect(metersPerPixel(-45, 12)).toBeCloseTo(metersPerPixel(45, 12), 9);
  });
});

describe("metersToPixels / pixelsToMeters", () => {
  it("round-trips", () => {
    const pixels = metersToPixels(1_500, AHMEDABAD.lat, 14);
    expect(pixelsToMeters(pixels, AHMEDABAD.lat, 14)).toBeCloseTo(1_500, 6);
  });

  it("grows the pixel radius as zoom increases", () => {
    expect(metersToPixels(1_000, 23, 15)).toBeGreaterThan(
      metersToPixels(1_000, 23, 14),
    );
  });
});

describe("latLngToScreen", () => {
  it("puts the centre in the middle of the viewport", () => {
    const screen = latLngToScreen(AHMEDABAD, AHMEDABAD, 14, VIEWPORT);
    expect(screen.x).toBeCloseTo(400, 6);
    expect(screen.y).toBeCloseTo(300, 6);
  });

  it("places a point to the east on the right and north above", () => {
    const east = latLngToScreen(
      { lat: AHMEDABAD.lat, lng: AHMEDABAD.lng + 0.02 },
      AHMEDABAD,
      14,
      VIEWPORT,
    );
    expect(east.x).toBeGreaterThan(400);
    expect(east.y).toBeCloseTo(300, 3);

    const north = latLngToScreen(
      { lat: AHMEDABAD.lat + 0.02, lng: AHMEDABAD.lng },
      AHMEDABAD,
      14,
      VIEWPORT,
    );
    expect(north.y).toBeLessThan(300);
  });

  it("takes the shorter way round the antimeridian", () => {
    // A marker just east of 180 must appear beside a centre just west of it,
    // not a whole world away.
    const screen = latLngToScreen(
      { lat: 0, lng: -179.9 },
      { lat: 0, lng: 179.9 },
      8,
      VIEWPORT,
    );
    expect(Math.abs(screen.x - 400)).toBeLessThan(200);
  });

  it("is the inverse of screenToLatLng", () => {
    const target = { lat: 23.03, lng: 72.58 };
    const screen = latLngToScreen(target, AHMEDABAD, 15, VIEWPORT);
    const back = screenToLatLng(screen, AHMEDABAD, 15, VIEWPORT);
    expect(back.lat).toBeCloseTo(target.lat, 6);
    expect(back.lng).toBeCloseTo(target.lng, 6);
  });
});

describe("panCenter", () => {
  it("moves the centre opposite to the drag direction", () => {
    // Dragging the map right reveals what was to the west.
    const panned = panCenter(AHMEDABAD, 100, 0, 14);
    expect(panned.lng).toBeLessThan(AHMEDABAD.lng);
  });

  it("moves north when dragging down", () => {
    expect(panCenter(AHMEDABAD, 0, 100, 14).lat).toBeGreaterThan(AHMEDABAD.lat);
  });

  it("returns to the start after an equal and opposite drag", () => {
    const there = panCenter(AHMEDABAD, 120, -80, 14);
    const back = panCenter(there, -120, 80, 14);
    expect(back.lat).toBeCloseTo(AHMEDABAD.lat, 6);
    expect(back.lng).toBeCloseTo(AHMEDABAD.lng, 6);
  });

  it("stops at the poles rather than wrapping vertically", () => {
    const top = panCenter({ lat: 84, lng: 0 }, 0, -100_000, 5);
    expect(top.lat).toBeLessThanOrEqual(MAX_LATITUDE);
    expect(Number.isFinite(top.lat)).toBe(true);

    const bottom = panCenter({ lat: -84, lng: 0 }, 0, 100_000, 5);
    expect(bottom.lat).toBeGreaterThanOrEqual(-MAX_LATITUDE);
  });

  it("wraps horizontally past the antimeridian", () => {
    const panned = panCenter({ lat: 0, lng: 179.99 }, -1_000, 0, 8);
    expect(panned.lng).toBeGreaterThanOrEqual(-180);
    expect(panned.lng).toBeLessThan(180);
  });
});

describe("visibleTiles", () => {
  it("covers the viewport with a padding ring", () => {
    const tiles = visibleTiles(AHMEDABAD, 12, VIEWPORT, 1);
    // 800x600 needs 4x3 tiles plus a one-tile ring: 6 columns x 5 rows.
    expect(tiles).toHaveLength(30);
  });

  it("returns fewer tiles with no padding", () => {
    expect(visibleTiles(AHMEDABAD, 12, VIEWPORT, 0)).toHaveLength(12);
  });

  it("positions the tile containing the centre across the middle", () => {
    const tiles = visibleTiles(AHMEDABAD, 12, VIEWPORT, 0);
    const centerTile = tiles.find((tile) => tile.x === 2873 && tile.y === 1778);
    expect(centerTile).toBeDefined();
    expect(centerTile!.left).toBeLessThanOrEqual(400);
    expect(centerTile!.left + TILE_SIZE).toBeGreaterThanOrEqual(400);
  });

  it("wraps tile x across the antimeridian but keeps distinct keys", () => {
    const tiles = visibleTiles({ lat: 0, lng: 179.99 }, 4, VIEWPORT, 0);
    const tilesPerAxis = 2 ** 4;
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(tilesPerAxis);
    }
    expect(new Set(tiles.map((tile) => tile.key)).size).toBe(tiles.length);
  });

  it("drops rows outside the world instead of requesting them", () => {
    const tiles = visibleTiles({ lat: 84, lng: 0 }, 3, VIEWPORT, 2);
    for (const tile of tiles) {
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(2 ** 3);
    }
  });

  it("clamps the requested zoom", () => {
    for (const tile of visibleTiles(AHMEDABAD, 99, VIEWPORT, 0)) {
      expect(tile.z).toBe(MAX_ZOOM);
    }
  });

  it("returns nothing for a zero-size viewport rather than throwing", () => {
    expect(() =>
      visibleTiles(AHMEDABAD, 12, { width: 0, height: 0 }, 0),
    ).not.toThrow();
  });
});

describe("tileUrl", () => {
  it("substitutes z, x, and y", () => {
    expect(
      tileUrl("https://tile.example.com/{z}/{x}/{y}.png", { x: 1, y: 2, z: 3 }),
    ).toBe("https://tile.example.com/3/1/2.png");
  });

  it("substitutes a subdomain deterministically", () => {
    const url = tileUrl("https://{s}.tile.example.com/{z}/{x}/{y}.png", {
      x: 1,
      y: 2,
      z: 3,
    });
    expect(url).toBe("https://a.tile.example.com/3/1/2.png");
    // Same tile, same host — so the browser cache is not fragmented.
    expect(
      tileUrl("https://{s}.tile.example.com/{z}/{x}/{y}.png", {
        x: 1,
        y: 2,
        z: 3,
      }),
    ).toBe(url);
  });

  it("leaves unknown placeholders untouched", () => {
    // A stored template must not be able to reach into the rest of the URL.
    expect(
      tileUrl("https://tile.example.com/{z}/{x}/{y}.png?k={apikey}", {
        x: 1,
        y: 2,
        z: 3,
      }),
    ).toBe("https://tile.example.com/3/1/2.png?k={apikey}");
  });
});

describe("zoomForRadius", () => {
  it("frames a small radius closely and a large one loosely", () => {
    const tight = zoomForRadius(500, 23, VIEWPORT);
    const wide = zoomForRadius(15_000, 23, VIEWPORT);
    expect(tight).toBeGreaterThan(wide);
  });

  it("keeps the diameter inside the viewport", () => {
    for (const radius of [300, 1_000, 2_000, 5_000, 15_000]) {
      const zoom = zoomForRadius(radius, 23, VIEWPORT);
      const pixels = metersToPixels(radius, 23, zoom);
      expect(pixels * 2).toBeLessThanOrEqual(Math.min(800, 600));
    }
  });

  it("stays within the supported zoom range", () => {
    expect(zoomForRadius(1, 23, VIEWPORT)).toBeLessThanOrEqual(MAX_ZOOM);
    expect(zoomForRadius(20_000_000, 23, VIEWPORT)).toBe(MIN_ZOOM);
  });

  it("falls back sensibly for a degenerate viewport or radius", () => {
    expect(zoomForRadius(1_000, 23, { width: 0, height: 0 })).toBe(14);
    expect(zoomForRadius(0, 23, VIEWPORT)).toBe(14);
  });
});

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters(AHMEDABAD, AHMEDABAD)).toBeCloseTo(0, 6);
  });

  it("matches a known distance", () => {
    // Ahmedabad to Mumbai is about 440 km.
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const distance = haversineMeters(AHMEDABAD, mumbai);
    expect(distance).toBeGreaterThan(430_000);
    expect(distance).toBeLessThan(450_000);
  });

  it("is symmetric", () => {
    const other = { lat: 23.1, lng: 72.6 };
    expect(haversineMeters(AHMEDABAD, other)).toBeCloseTo(
      haversineMeters(other, AHMEDABAD),
      6,
    );
  });

  it("measures one degree of latitude as about 111 km", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      111_195,
      -2,
    );
  });
});
