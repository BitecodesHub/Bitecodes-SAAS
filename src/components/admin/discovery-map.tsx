"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Minus, Plus, Crosshair } from "lucide-react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampZoom,
  haversineMeters,
  latLngToScreen,
  metersToPixels,
  panCenter,
  screenToLatLng,
  tileUrl,
  visibleTiles,
  type LatLng,
} from "@/lib/prospecting/tiles";
import { OSM_ATTRIBUTION } from "@/lib/prospecting/categories";
import { cn } from "@/lib/utils";

/**
 * The discovery map.
 *
 * A deliberately small slippy map: raster tiles, a draggable centre pin, a
 * radius circle, and result markers. All the arithmetic lives in
 * `@/lib/prospecting/tiles`, which is unit-tested, so this component is only
 * event handling and layout.
 *
 * Accessibility is not an afterthought here — a pointer-only map would make the
 * feature unusable for anyone navigating by keyboard. The viewport is focusable
 * and responds to arrow keys for panning and +/- for zoom, and the search box
 * above it (in the parent) is a complete alternative route to any location.
 */

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Drives the marker colour; a classification tag or status. */
  variant?: "default" | "critical" | "warning" | "good" | "muted";
}

interface DiscoveryMapProps {
  center: LatLng;
  onCenterChange: (center: LatLng) => void;
  /**
   * Controlled by the parent so choosing a place can re-frame the map without
   * remounting it. Keying the component on zoom instead would throw away every
   * loaded tile on each change.
   */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  radiusMeters: number;
  markers?: MapMarker[];
  tileUrlTemplate: string;
  tileAttribution?: string;
  className?: string;
  /** Called when a marker is activated, for the detail panel. */
  onMarkerSelect?: (id: string) => void;
  selectedMarkerId?: string | null;
}

const MARKER_COLORS: Record<
  NonNullable<MapMarker["variant"]>,
  { fill: string; ring: string }
> = {
  default: { fill: "var(--chart-1)", ring: "var(--background)" },
  critical: { fill: "var(--chart-critical)", ring: "var(--background)" },
  warning: { fill: "var(--chart-4)", ring: "var(--background)" },
  good: { fill: "var(--chart-3)", ring: "var(--background)" },
  muted: { fill: "var(--muted-foreground)", ring: "var(--background)" },
};

/** Keyboard pan step, in pixels. */
const KEY_PAN_PIXELS = 60;

export function DiscoveryMap({
  center,
  onCenterChange,
  zoom,
  onZoomChange,
  radiusMeters,
  markers = [],
  tileUrlTemplate,
  tileAttribution = OSM_ATTRIBUTION,
  className,
  onMarkerSelect,
  selectedMarkerId = null,
}: DiscoveryMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failedTiles, setFailedTiles] = useState<Set<string>>(new Set());
  const describedById = useId();

  // Track the element's real size: tile coverage depends on it, and a hardcoded
  // guess would leave gaps on wide screens and waste requests on narrow ones.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize({ width: Math.round(box.width), height: Math.round(box.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(
    () => (size.width > 0 ? visibleTiles(center, zoom, size, 1) : []),
    [center, zoom, size],
  );

  const radiusPixels = useMemo(
    () => metersToPixels(radiusMeters, center.lat, zoom),
    [radiusMeters, center.lat, zoom],
  );

  // ---------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------

  const dragState = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  /**
   * Set when a drag actually moved the map, and read by the click handler.
   *
   * A separate ref is needed because `pointerup` fires before `click` and
   * clears `dragState`. Reading "did we drag?" from `dragState` inside the click
   * handler would always see null, so every drag would also be treated as a
   * click and jump the search centre to wherever the pointer was released.
   */
  const suppressNextClick = useRef(false);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // Ignore secondary buttons so a right-click does not start a drag.
    if (event.button !== 0) return;
    dragState.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    // Capture keeps the drag alive when the pointer leaves the element.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId !== event.pointerId) return;

      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      if (dx === 0 && dy === 0) return;

      state.lastX = event.clientX;
      state.lastY = event.clientY;
      // A few pixels of jitter should not count as a drag, or every click
      // would be swallowed.
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        state.moved = true;
        suppressNextClick.current = true;
      }

      onCenterChange(panCenter(center, dx, dy, zoom));
    },
    [center, zoom, onCenterChange],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const state = dragState.current;
    if (state?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragState.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------

  /**
   * Zooms about a screen point, keeping the coordinate under the cursor fixed.
   *
   * Zooming about the centre instead is the classic annoyance: the thing you
   * were aiming at slides away as you zoom in.
   */
  const zoomAbout = useCallback(
    (nextZoom: number, anchor?: { x: number; y: number }) => {
      const clamped = clampZoom(nextZoom);
      if (clamped === zoom) return;

      if (!anchor || size.width === 0) {
        onZoomChange(clamped);
        return;
      }

      const anchorLatLng = screenToLatLng(anchor, center, zoom, size);
      onZoomChange(clamped);
      // Re-place the anchor at the same screen position under the new zoom.
      const afterCenter = screenToLatLng(
        { x: size.width - anchor.x, y: size.height - anchor.y },
        anchorLatLng,
        clamped,
        size,
      );
      onCenterChange(afterCenter);
    },
    [zoom, center, size, onCenterChange, onZoomChange],
  );

  // Wheel zoom is registered natively, not via onWheel: React's wheel handler
  // is passive, so `preventDefault` there is ignored and the page scrolls
  // behind the map.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoomAbout(zoom + (event.deltaY < 0 ? 1 : -1), {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoom, zoomAbout]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const pan = (dx: number, dy: number) => {
        event.preventDefault();
        onCenterChange(panCenter(center, dx, dy, zoom));
      };

      switch (event.key) {
        case "ArrowLeft":
          return pan(KEY_PAN_PIXELS, 0);
        case "ArrowRight":
          return pan(-KEY_PAN_PIXELS, 0);
        case "ArrowUp":
          return pan(0, KEY_PAN_PIXELS);
        case "ArrowDown":
          return pan(0, -KEY_PAN_PIXELS);
        case "+":
        case "=":
          event.preventDefault();
          return onZoomChange(clampZoom(zoom + 1));
        case "-":
        case "_":
          event.preventDefault();
          return onZoomChange(clampZoom(zoom - 1));
        default:
          return undefined;
      }
    },
    [center, zoom, onCenterChange, onZoomChange],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const box = event.currentTarget.getBoundingClientRect();
      zoomAbout(zoom + 1, {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
    },
    [zoom, zoomAbout],
  );

  /** A click that was not the tail end of a drag moves the search centre. */
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (suppressNextClick.current) {
        suppressNextClick.current = false;
        return;
      }
      const box = event.currentTarget.getBoundingClientRect();
      onCenterChange(
        screenToLatLng(
          { x: event.clientX - box.left, y: event.clientY - box.top },
          center,
          zoom,
          size,
        ),
      );
    },
    [center, zoom, size, onCenterChange],
  );

  const markersOnScreen = useMemo(() => {
    if (size.width === 0) return [];
    return markers.map((marker) => ({
      marker,
      position: latLngToScreen(marker, center, zoom, size),
      insideRadius:
        haversineMeters(center, { lat: marker.lat, lng: marker.lng }) <=
        radiusMeters,
    }));
  }, [markers, center, zoom, size, radiusMeters]);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={viewportRef}
        role="application"
        aria-label="Discovery area map"
        aria-describedby={describedById}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        className="border-border bg-muted focus-visible:ring-ring relative h-[380px] w-full cursor-grab touch-none overflow-hidden rounded-2xl border select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:cursor-grabbing sm:h-[460px]"
      >
        {/* Tiles */}
        {tiles.map((tile) => {
          const url = tileUrl(tileUrlTemplate, tile);
          if (failedTiles.has(url)) return null;
          return (
            // Raster map tiles from a third-party CDN. `next/image` would route
            // every one of the ~30 tiles per view through the optimiser, which
            // adds cost and latency and cannot improve an already-optimised
            // 256px PNG.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tile.key}
              src={url}
              alt=""
              aria-hidden="true"
              draggable={false}
              width={TILE_SIZE}
              height={TILE_SIZE}
              onError={() =>
                setFailedTiles((current) => new Set(current).add(url))
              }
              className="pointer-events-none absolute"
              style={{ left: tile.left, top: tile.top }}
            />
          );
        })}

        {/* Radius circle */}
        {size.width > 0 && (
          <div
            aria-hidden="true"
            className="border-primary bg-primary/10 pointer-events-none absolute rounded-full border-2 border-dashed"
            style={{
              width: radiusPixels * 2,
              height: radiusPixels * 2,
              left: size.width / 2 - radiusPixels,
              top: size.height / 2 - radiusPixels,
            }}
          />
        )}

        {/* Result markers */}
        {markersOnScreen.map(({ marker, position, insideRadius }) => {
          const colors = MARKER_COLORS[marker.variant ?? "default"];
          const isSelected = marker.id === selectedMarkerId;
          return (
            <button
              key={marker.id}
              type="button"
              title={marker.label}
              onClick={(event) => {
                event.stopPropagation();
                onMarkerSelect?.(marker.id);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none"
              style={{
                left: position.x,
                top: position.y,
                width: isSelected ? 16 : 11,
                height: isSelected ? 16 : 11,
                background: colors.fill,
                border: `2px solid ${colors.ring}`,
                // Outside the circle it will not be included in the search, so
                // it is shown but visibly discounted.
                opacity: insideRadius ? 1 : 0.35,
                zIndex: isSelected ? 20 : 10,
              }}
            >
              <span className="sr-only">{marker.label}</span>
            </button>
          );
        })}

        {/* Centre pin — drawn last so it sits above the markers. */}
        {size.width > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ left: size.width / 2, top: size.height / 2 }}
          >
            <Crosshair className="text-primary size-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-40 flex flex-col gap-1">
          <MapButton
            label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => onZoomChange(clampZoom(zoom + 1))}
          >
            <Plus className="size-4" />
          </MapButton>
          <MapButton
            label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => onZoomChange(clampZoom(zoom - 1))}
          >
            <Minus className="size-4" />
          </MapButton>
        </div>

        {/* Attribution — required by the ODbL licence on OSM data and tiles. */}
        <p className="bg-background/85 text-muted-foreground absolute right-0 bottom-0 z-40 rounded-tl-md px-2 py-1 text-[11px]">
          {tileAttribution}
        </p>
      </div>

      <p id={describedById} className="text-muted-foreground text-xs">
        Drag to move, scroll or use + and − to zoom, click to set the centre.
        With the map focused, arrow keys pan. Centre {center.lat.toFixed(4)},{" "}
        {center.lng.toFixed(4)} · zoom {zoom} · radius{" "}
        {radiusMeters >= 1000
          ? `${(radiusMeters / 1000).toFixed(1)} km`
          : `${radiusMeters} m`}
        .
      </p>
    </div>
  );
}

function MapButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="border-border bg-background/90 text-foreground hover:bg-background focus-visible:ring-ring grid size-8 place-items-center rounded-lg border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
