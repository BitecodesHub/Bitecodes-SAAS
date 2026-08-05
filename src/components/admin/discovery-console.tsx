"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Radar,
  Search,
  Zap,
} from "lucide-react";
import { DiscoveryMap } from "@/components/admin/discovery-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PROSPECT_CATEGORIES,
  OSM_ATTRIBUTION,
} from "@/lib/prospecting/categories";
import { RADIUS_LIMITS } from "@/lib/prospecting/overpass-query";
import { zoomForRadius, type LatLng } from "@/lib/prospecting/tiles";
import {
  createAutopilotPresetAction,
  describeAreaAction,
  getDiscoveryProgressAction,
  previewAreaAction,
  searchPlaceAction,
  startDiscoveryAction,
  type DiscoveryProgress,
} from "@/lib/server/prospecting/actions";
import { cn } from "@/lib/utils";

/**
 * The "grab new customers" console.
 *
 * Four steps, in the order an operator thinks about them: *where*, *what kind of
 * business*, *how many is that*, then *go*. The count preview before the run is
 * the important one — without it, picking a radius is guesswork, and a run that
 * returns four results or four hundred is equally unhelpful.
 *
 * Discovery is queued rather than awaited, so this component polls for progress.
 * The alternative — holding the request open through an Overpass query and a few
 * hundred website audits — would exceed any platform request timeout.
 */

interface DiscoveryConsoleProps {
  initialCenter: LatLng;
  tileUrlTemplate: string;
  tileAttribution: string;
}

interface PlaceOption {
  label: string;
  lat: number;
  lng: number;
  suggestedRadiusMeters: number;
}

/** Debounce for the count preview, so dragging the slider is not a request storm. */
const PREVIEW_DEBOUNCE_MS = 700;
const PROGRESS_POLL_MS = 2_500;

export function DiscoveryConsole({
  initialCenter,
  tileUrlTemplate,
  tileAttribution,
}: DiscoveryConsoleProps) {
  const [center, setCenter] = useState<LatLng>(initialCenter);
  const [zoom, setZoom] = useState(14);
  // Annotated because `RADIUS_LIMITS` is `as const`, so the inferred type would
  // be the literal 2000 rather than number.
  const [radiusMeters, setRadiusMeters] = useState<number>(
    RADIUS_LIMITS.default,
  );
  const [categories, setCategories] = useState<string[]>(["food-drink"]);
  const [areaLabel, setAreaLabel] = useState<string>("");

  const [placeQuery, setPlaceQuery] = useState("");
  const [placeOptions, setPlaceOptions] = useState<PlaceOption[]>([]);
  const [searching, startSearching] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  /**
   * The last count, tagged with the inputs it was measured for.
   *
   * Storing the key rather than a `stale` flag means staleness is derived on
   * render. A boolean would have to be flipped from an effect on every input
   * change, which is a cascading render and, worse, leaves a window where a
   * count from a previous area is still labelled current.
   */
  const [preview, setPreview] = useState<{
    key: string;
    total: number;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [searchId, setSearchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [starting, startRun] = useTransition();
  const [runError, setRunError] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Place search
  // -------------------------------------------------------------------

  const handlePlaceSearch = useCallback(() => {
    if (placeQuery.trim().length < 2) return;
    setSearchError(null);
    startSearching(async () => {
      const result = await searchPlaceAction(placeQuery);
      if (!result.ok) {
        setSearchError(result.error);
        setPlaceOptions([]);
        return;
      }
      setPlaceOptions(result.data);
      if (result.data.length === 0) {
        setSearchError("No places matched that search.");
      }
    });
  }, [placeQuery]);

  const choosePlace = useCallback((place: PlaceOption) => {
    setCenter({ lat: place.lat, lng: place.lng });
    setRadiusMeters(place.suggestedRadiusMeters);
    // Frame the suggested radius rather than leaving the operator to zoom by
    // hand: a neighbourhood search opened at world zoom looks empty.
    setZoom(
      zoomForRadius(place.suggestedRadiusMeters, place.lat, {
        width: 800,
        height: 460,
      }),
    );
    setAreaLabel(place.label);
    setPlaceOptions([]);
    setPlaceQuery(place.label.split(",")[0] ?? "");
  }, []);

  // -------------------------------------------------------------------
  // Area label for a hand-placed pin
  // -------------------------------------------------------------------

  const labelRequestRef = useRef(0);
  useEffect(() => {
    const token = ++labelRequestRef.current;
    const timer = setTimeout(async () => {
      const result = await describeAreaAction(center.lat, center.lng);
      // Ignore a slow response that a newer request has superseded.
      if (token !== labelRequestRef.current) return;
      if (result.ok) setAreaLabel(result.data.label);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [center.lat, center.lng]);

  // -------------------------------------------------------------------
  // Count preview
  // -------------------------------------------------------------------

  const previewKey = `${center.lat.toFixed(4)}|${center.lng.toFixed(4)}|${radiusMeters}|${categories.join(",")}`;
  const previewFresh = preview !== null && preview.key === previewKey;
  const previewStale = preview !== null && preview.key !== previewKey;

  const previewRequestRef = useRef(0);
  useEffect(() => {
    // Nothing to count, and nothing to clear: with no categories the readout
    // renders a dash from derived state rather than from an effect.
    if (categories.length === 0) return;

    const token = ++previewRequestRef.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      setPreviewError(null);
      const result = await previewAreaAction({
        lat: center.lat,
        lng: center.lng,
        radiusMeters,
        categories,
      });
      if (token !== previewRequestRef.current) return;

      setPreviewing(false);
      if (!result.ok) {
        setPreviewError(result.error);
        setPreview(null);
        return;
      }
      setPreview({ key: previewKey, total: result.data.total });
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [center.lat, center.lng, radiusMeters, categories, previewKey]);

  // -------------------------------------------------------------------
  // Run and poll
  // -------------------------------------------------------------------

  const handleRun = useCallback(() => {
    setRunError(null);
    startRun(async () => {
      const result = await startDiscoveryAction({
        lat: center.lat,
        lng: center.lng,
        radiusMeters,
        categories,
        label: areaLabel || undefined,
      });
      if (!result.ok) {
        setRunError(result.error);
        return;
      }
      setSearchId(result.data.searchId);
      setProgress({
        status: "queued",
        discovered: 0,
        added: 0,
        skipped: 0,
        error: null,
        label: areaLabel || "Selected area",
        pendingEnrichment: 0,
        classified: 0,
      });
    });
  }, [center, radiusMeters, categories, areaLabel]);

  const [savingPreset, startSavePreset] = useTransition();
  const [presetMessage, setPresetMessage] = useState<string | null>(null);

  const handleSavePreset = useCallback(() => {
    setPresetMessage(null);
    startSavePreset(async () => {
      const result = await createAutopilotPresetAction({
        lat: center.lat,
        lng: center.lng,
        radiusMeters,
        categories,
        label:
          areaLabel || `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`,
        // Twice a week keeps a single area fresh without re-hammering Overpass.
        cadenceHours: 72,
      });
      setPresetMessage(
        result.ok
          ? "Saved. Autopilot will re-run this search every 3 days — manage it in the Autopilot panel above."
          : result.error,
      );
    });
  }, [center, radiusMeters, categories, areaLabel]);

  // Depends only on `searchId`. Including `progress` here would re-arm the
  // timer on every response, so each poll would immediately schedule the next
  // one and the interval would collapse to "as fast as the server answers".
  useEffect(() => {
    if (!searchId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const result = await getDiscoveryProgressAction(searchId);
      if (cancelled) return;

      if (result.ok) {
        setProgress(result.data);
        // Stop once the run failed, or finished with enrichment drained.
        const settled =
          result.data.status === "failed" ||
          (result.data.status === "completed" &&
            result.data.pendingEnrichment === 0);
        if (settled) return;
      }

      timer = setTimeout(tick, PROGRESS_POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [searchId]);

  const toggleCategory = useCallback((id: string) => {
    setCategories((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const radiusLabel =
    radiusMeters >= 1_000
      ? `${(radiusMeters / 1_000).toFixed(1)} km`
      : `${radiusMeters} m`;

  const runDisabled =
    starting || categories.length === 0 || progress?.status === "running";

  return (
    <div className="space-y-6">
      {/* Step 1 — where */}
      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <header className="flex items-center gap-2">
          <StepBadge>1</StepBadge>
          <h2 className="text-base font-semibold">Choose an area</h2>
        </header>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="place" className="sr-only">
              Search for a place
            </Label>
            <Input
              id="place"
              value={placeQuery}
              placeholder="Search a city, suburb, or street — e.g. Navrangpura, Ahmedabad"
              onChange={(event) => setPlaceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handlePlaceSearch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handlePlaceSearch}
            disabled={searching || placeQuery.trim().length < 2}
          >
            {searching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Find
          </Button>
        </div>

        {searchError && <FieldError>{searchError}</FieldError>}

        {placeOptions.length > 0 && (
          <ul className="border-border divide-border divide-y rounded-xl border">
            {placeOptions.map((place) => (
              <li key={`${place.lat},${place.lng}`}>
                <button
                  type="button"
                  onClick={() => choosePlace(place)}
                  className="hover:bg-muted flex w-full items-start gap-2 p-3 text-left text-sm transition-colors"
                >
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span className="flex-1">{place.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DiscoveryMap
          center={center}
          onCenterChange={setCenter}
          zoom={zoom}
          onZoomChange={setZoom}
          radiusMeters={radiusMeters}
          tileUrlTemplate={tileUrlTemplate}
          tileAttribution={tileAttribution}
        />

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="radius">Search radius</Label>
            <span className="text-muted-foreground text-sm tabular-nums">
              {radiusLabel}
            </span>
          </div>
          <input
            id="radius"
            type="range"
            min={RADIUS_LIMITS.min}
            max={RADIUS_LIMITS.max}
            step={100}
            value={radiusMeters}
            onChange={(event) => setRadiusMeters(Number(event.target.value))}
            className="accent-primary w-full"
          />
          {areaLabel && (
            <p className="text-muted-foreground text-xs">
              Centre: <span className="text-foreground">{areaLabel}</span>
            </p>
          )}
        </div>
      </section>

      {/* Step 2 — what kind of business */}
      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <header className="flex items-center gap-2">
          <StepBadge>2</StepBadge>
          <h2 className="text-base font-semibold">Pick business types</h2>
        </header>

        <div className="flex flex-wrap gap-2">
          {PROSPECT_CATEGORIES.map((category) => {
            const selected = categories.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                title={category.description}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              setCategories(PROSPECT_CATEGORIES.map((entry) => entry.id))
            }
            className="text-primary underline-offset-2 hover:underline"
          >
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => setCategories([])}
            className="text-primary underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>

        {categories.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Pick at least one type of business to search for.
          </p>
        )}
      </section>

      {/* Step 3 — how many, then go */}
      <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <header className="flex items-center gap-2">
          <StepBadge>3</StepBadge>
          <h2 className="text-base font-semibold">Review and run</h2>
        </header>

        <div className="border-border bg-muted/40 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border p-4">
          <div>
            <p className="text-muted-foreground text-xs">
              Businesses in this area
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {previewing ? (
                <span className="text-muted-foreground inline-flex items-center gap-2 text-base font-normal">
                  <Loader2 className="size-4 animate-spin" />
                  Counting…
                </span>
              ) : preview && categories.length > 0 ? (
                <span className={previewStale ? "text-muted-foreground" : ""}>
                  ≈{preview.total.toLocaleString()}
                </span>
              ) : (
                <span className="text-muted-foreground text-base font-normal">
                  —
                </span>
              )}
            </p>
          </div>
          <div className="text-muted-foreground text-sm">
            <p>
              {categories.length} business{" "}
              {categories.length === 1 ? "type" : "types"} · {radiusLabel}{" "}
              radius
            </p>
            <p>Named businesses only. {OSM_ATTRIBUTION}.</p>
          </div>
        </div>

        {previewError && <FieldError>{previewError}</FieldError>}
        {runError && <FieldError>{runError}</FieldError>}

        {previewFresh && preview.total > 400 && (
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              That is a large area. A run keeps the first 500 businesses —
              narrow the radius or the categories for a more focused list.
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleRun} disabled={runDisabled}>
            {starting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            Grab these customers
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSavePreset}
            disabled={runDisabled || savingPreset}
          >
            {savingPreset ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            Save as autopilot search
          </Button>
        </div>

        {presetMessage && (
          <p className="border-border bg-muted/40 rounded-xl border p-3 text-sm leading-relaxed">
            {presetMessage}
          </p>
        )}

        {progress && <ProgressPanel progress={progress} searchId={searchId} />}
      </section>
    </div>
  );
}

function ProgressPanel({
  progress,
  searchId,
}: {
  progress: DiscoveryProgress;
  searchId: string | null;
}) {
  const running = progress.status === "queued" || progress.status === "running";
  const enriching =
    progress.status === "completed" && progress.pendingEnrichment > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border bg-background space-y-3 rounded-xl border p-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {progress.status === "failed" ? (
          <AlertTriangle className="text-destructive size-4" />
        ) : running || enriching ? (
          <Loader2 className="text-primary size-4 animate-spin" />
        ) : (
          <CheckCircle2
            className="size-4"
            style={{ color: "var(--chart-3)" }}
          />
        )}
        <span>
          {progress.status === "queued" && "Queued…"}
          {progress.status === "running" && "Searching the map…"}
          {progress.status === "failed" && "Discovery failed"}
          {progress.status === "completed" &&
            (enriching
              ? "Checking each website…"
              : "Done — customers are in your list")}
        </span>
      </div>

      {progress.error && (
        <p className="text-destructive text-sm">{progress.error}</p>
      )}

      {progress.status === "completed" && (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Figure label="Found" value={progress.discovered} />
          <Figure label="Added" value={progress.added} />
          <Figure label="Classified" value={progress.classified} />
          <Figure label="Still checking" value={progress.pendingEnrichment} />
        </dl>
      )}

      {progress.status === "completed" && progress.added === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing new here — every business in this area was already in your
          list. Try a different area or more business types.
        </p>
      )}

      {progress.status === "completed" && searchId && (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/customers?searchId=${searchId}`}>
            View these customers
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="secondary"
      className="size-6 justify-center rounded-full p-0"
    >
      {children}
    </Badge>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  );
}
