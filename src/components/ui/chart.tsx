"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Table2 } from "lucide-react";
import {
  buildAreaPath,
  buildLinePath,
  buildScale,
  formatCompact,
  formatDelta,
  labelledIndices,
  niceTicks,
  percentageChange,
} from "@/lib/chart";
import { cn } from "@/lib/utils";

/**
 * Dashboard charts, drawn as plain SVG.
 *
 * No charting dependency: these four forms are all the admin panel needs, and
 * hand-drawn SVG keeps the series colours on the validated `--chart-*` tokens
 * (see `globals.css`) rather than a library's own palette.
 *
 * Rules these components enforce, rather than leave to the caller:
 *
 * - **Series colour comes from slot order**, never cycled. A ninth series is a
 *   design error, so `SERIES` has five slots and no wraparound.
 * - **Text never wears the series colour.** Values and labels use text tokens;
 *   identity comes from a coloured swatch beside the text. Chart slots 3–5 fall
 *   below 3:1 on the light surface, so coloured text would be illegible.
 * - **A table view is always available.** It is the accessible equivalent of the
 *   plot and the required relief for those low-contrast slots.
 * - **A hover layer is standard**, not opt-in — an SVG chart in a browser is
 *   interactive, and a value the reader cannot retrieve is a value not shown.
 * - **A legend appears only for two or more series.** For one series the title
 *   already names it, and a one-swatch box is wasted space.
 */

/** Fixed slot order. Assigned by position, never cycled. */
const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const MAX_SERIES = SERIES.length;

function seriesColor(index: number) {
  // Deliberately clamps instead of wrapping: a wrapped colour silently gives
  // two different series the same identity.
  return SERIES[Math.min(index, SERIES.length - 1)]!;
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export interface StatTileProps {
  label: string;
  value: number;
  /** Previous period, for the delta. Omit when there is no comparison. */
  previous?: number;
  /** Period name shown beside the delta, e.g. "vs last week". */
  comparisonLabel?: string;
  /** 12-ish points, oldest first. */
  trend?: number[];
  /** False when a rise is bad (e.g. bounced emails). */
  higherIsBetter?: boolean;
  /** Renders as the single hero figure of the view. Use once per page. */
  hero?: boolean;
  hint?: string;
  className?: string;
}

export function StatTile({
  label,
  value,
  previous,
  comparisonLabel = "vs previous period",
  trend,
  higherIsBetter = true,
  hero = false,
  hint,
  className,
}: StatTileProps) {
  const change =
    previous === undefined ? null : percentageChange(value, previous);
  const isGood =
    change === null || change === 0 ? null : change > 0 === higherIsBetter;

  return (
    <div
      className={cn(
        "border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">{label}</p>

      <p
        className={cn(
          // Proportional figures on purpose: tabular-nums gives every digit the
          // width of a zero, which makes a large number look gappy.
          "mt-1 font-semibold tracking-tight",
          hero ? "text-5xl" : "text-3xl",
        )}
      >
        {formatCompact(value)}
      </p>

      {change !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-sm">
          {/* Direction is carried by an arrow as well as by colour, so the
              delta is not colour-alone information. */}
          {change > 0 ? (
            <ArrowUp aria-hidden="true" className="size-3.5" />
          ) : change < 0 ? (
            <ArrowDown aria-hidden="true" className="size-3.5" />
          ) : null}
          <span
            className={cn(
              "font-medium",
              isGood === null
                ? "text-muted-foreground"
                : isGood
                  ? "text-[var(--chart-good)]"
                  : "text-destructive",
            )}
          >
            {formatDelta(change)}
          </span>
          <span className="text-muted-foreground">{comparisonLabel}</span>
        </p>
      )}

      {trend && trend.length > 1 && (
        <div className="mt-3">
          <Sparkline values={trend} label={`${label} trend`} />
        </div>
      )}

      {hint && (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

/**
 * A bare trend line. No axes, no labels — it conveys shape only, so it carries
 * an accessible summary instead of pretending to be readable.
 */
export function Sparkline({
  values,
  label,
  className,
}: {
  values: number[];
  label: string;
  className?: string;
}) {
  const width = 120;
  const height = 32;
  const max = Math.max(...values, 0);
  const scale = buildScale({
    count: values.length,
    yMax: niceTicks(max).at(-1) ?? 1,
    width,
    height,
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
  });

  const points = values.map((value, index) => ({
    x: scale.x(index),
    y: scale.y(value),
  }));
  const last = points.at(-1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-8 w-full max-w-[120px] overflow-visible", className)}
      role="img"
      aria-label={`${label}: ${values.length} points, from ${formatCompact(values[0] ?? 0)} to ${formatCompact(values.at(-1) ?? 0)}`}
    >
      <path
        d={buildAreaPath(points, scale.baseline)}
        fill="var(--chart-1)"
        opacity={0.1}
      />
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && (
        // 2px ring in the surface colour keeps the marker legible where it
        // crosses the line.
        <circle
          cx={last.x}
          cy={last.y}
          r={3}
          fill="var(--chart-1)"
          stroke="var(--color-card)"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface LineChartProps {
  /** X-axis category labels, one per data point. */
  labels: string[];
  series: ChartSeries[];
  title: string;
  /** Formats values in labels, ticks, and the tooltip. */
  format?: (value: number) => string;
  className?: string;
}

export function LineChart({
  labels,
  series,
  title,
  format = formatCompact,
  className,
}: LineChartProps) {
  const [active, setActive] = React.useState<number | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const width = 640;
  const height = 240;
  const padding = { top: 16, right: 24, bottom: 28, left: 44 };

  const max = Math.max(0, ...series.flatMap((entry) => entry.values));
  const ticks = niceTicks(max);
  const scale = buildScale({
    count: labels.length,
    yMax: ticks.at(-1) ?? 1,
    width,
    height,
    padding,
  });

  const empty = labels.length === 0 || series.length === 0;

  return (
    <figure className={cn("min-w-0", className)}>
      <ChartHeader
        title={title}
        series={series}
        showTable={showTable}
        onToggleTable={() => setShowTable((value) => !value)}
      />

      {empty ? (
        <EmptyPlot />
      ) : showTable ? (
        <ChartTable labels={labels} series={series} format={format} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-60 w-full min-w-[480px]"
            role="img"
            aria-label={`${title}. ${series.length} series over ${labels.length} periods. Switch to the table view for exact values.`}
            onMouseLeave={() => setActive(null)}
          >
            {/* Gridlines: hairline, solid, one step off the surface. */}
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={scale.y(tick)}
                  y2={scale.y(tick)}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 8}
                  y={scale.y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px] [font-variant-numeric:tabular-nums]"
                >
                  {format(tick)}
                </text>
              </g>
            ))}

            {/* X labels, thinned so they never overlap. */}
            {labels.map((label, index) => {
              const stride = Math.ceil(labels.length / 7);
              if (index % stride !== 0 && index !== labels.length - 1)
                return null;
              return (
                <text
                  key={`${label}-${index}`}
                  x={scale.x(index)}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {label}
                </text>
              );
            })}

            {series.map((entry, seriesIndex) => {
              const points = entry.values.map((value, index) => ({
                x: scale.x(index),
                y: scale.y(value),
              }));
              const color = seriesColor(seriesIndex);
              const labelled =
                series.length === 1 ? labelledIndices(entry.values) : [];

              return (
                <g key={entry.name}>
                  {series.length === 1 && (
                    <path
                      d={buildAreaPath(points, scale.baseline)}
                      fill={color}
                      opacity={0.1}
                    />
                  )}
                  <path
                    d={buildLinePath(points)}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {labelled.map((index) => (
                    <text
                      key={index}
                      x={scale.x(index)}
                      y={scale.y(entry.values[index]!) - 10}
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-semibold"
                    >
                      {format(entry.values[index]!)}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* Crosshair for the hovered period. */}
            {active !== null && (
              <line
                x1={scale.x(active)}
                x2={scale.x(active)}
                y1={padding.top}
                y2={scale.baseline}
                stroke="var(--chart-axis)"
                strokeWidth={1}
              />
            )}
            {active !== null &&
              series.map((entry, seriesIndex) => (
                <circle
                  key={entry.name}
                  cx={scale.x(active)}
                  cy={scale.y(entry.values[active] ?? 0)}
                  r={4}
                  fill={seriesColor(seriesIndex)}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              ))}

            {/*
              Invisible hit bands, one per period, each far wider than the
              marker. Hovering a 4px dot exactly is not a reasonable ask.
            */}
            {labels.map((label, index) => {
              const band = scale.plotWidth / Math.max(1, labels.length);
              return (
                <rect
                  key={`hit-${index}`}
                  x={scale.x(index) - band / 2}
                  y={padding.top}
                  width={band}
                  height={scale.plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  tabIndex={-1}
                />
              );
            })}
          </svg>

          {/* Tooltip as HTML rather than SVG text, so it can wrap and scroll. */}
          <div aria-live="polite" className="min-h-9">
            {active !== null && (
              <div className="border-border bg-card mt-2 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2 text-xs shadow-[var(--shadow-soft)]">
                <span className="font-semibold">{labels[active]}</span>
                {series.map((entry, seriesIndex) => (
                  <span key={entry.name} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: seriesColor(seriesIndex) }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="font-medium [font-variant-numeric:tabular-nums]">
                      {format(entry.values[active] ?? 0)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

export interface BarDatum {
  label: string;
  value: number;
  /** Overrides the series colour, for status-coded bars. */
  color?: string;
}

/**
 * Horizontal ranked bars.
 *
 * Horizontal because category names are words: as columns they would need
 * rotating, and rotated labels are markedly harder to read. One hue throughout —
 * the bars encode magnitude, not identity, so multiple colours would imply a
 * distinction that is not in the data.
 */
export function BarChart({
  data,
  title,
  format = formatCompact,
  className,
}: {
  data: BarDatum[];
  title: string;
  format?: (value: number) => string;
  className?: string;
}) {
  const [showTable, setShowTable] = React.useState(false);
  const max = Math.max(0, ...data.map((datum) => datum.value));
  const top = niceTicks(max).at(-1) ?? 1;

  return (
    <figure className={cn("min-w-0", className)}>
      <ChartHeader
        title={title}
        series={[]}
        showTable={showTable}
        onToggleTable={() => setShowTable((value) => !value)}
      />

      {data.length === 0 ? (
        <EmptyPlot />
      ) : showTable ? (
        <ChartTable
          labels={data.map((datum) => datum.label)}
          series={[{ name: title, values: data.map((datum) => datum.value) }]}
          format={format}
        />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {data.map((datum) => {
            const percentage = top > 0 ? (datum.value / top) * 100 : 0;
            return (
              <li key={datum.label} className="flex items-center gap-3">
                <span className="text-muted-foreground w-36 shrink-0 truncate text-sm">
                  {datum.label}
                </span>
                {/*
                  A div-based track rather than SVG: it reflows with the
                  container for free, and the value label is real text that can
                  never be clipped by the mark.
                */}
                <span className="bg-muted/50 relative h-6 min-w-0 flex-1 overflow-hidden rounded-md">
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px]"
                    style={{
                      width: `${Math.max(percentage, datum.value > 0 ? 1.5 : 0)}%`,
                      background: datum.color ?? "var(--chart-1)",
                    }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right text-sm font-semibold [font-variant-numeric:tabular-nums]">
                  {format(datum.value)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function ChartHeader({
  title,
  series,
  showTable,
  onToggleTable,
}: {
  title: string;
  series: ChartSeries[];
  showTable: boolean;
  onToggleTable: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <figcaption className="font-semibold tracking-tight">
          {title}
        </figcaption>

        {/* A legend only earns its space from two series up. */}
        {series.length > 1 && (
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {series.map((entry, index) => (
              <li
                key={entry.name}
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
              >
                <span
                  aria-hidden="true"
                  className="h-0.5 w-4 rounded-full"
                  style={{ background: seriesColor(index) }}
                />
                {entry.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleTable}
        aria-pressed={showTable}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Table2 aria-hidden="true" className="size-3.5" />
        {showTable ? "Show chart" : "Show table"}
      </button>
    </div>
  );
}

/**
 * The table equivalent of the plot.
 *
 * Always reachable, and load-bearing: chart slots 3–5 sit below 3:1 against the
 * light surface, and the documented relief for that is visible labels or a table
 * view. This is that table.
 */
function ChartTable({
  labels,
  series,
  format,
}: {
  labels: string[];
  series: ChartSeries[];
  format: (value: number) => string;
}) {
  return (
    <div className="border-border mt-4 max-h-72 overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 sticky top-0">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Period
            </th>
            {series.map((entry) => (
              <th
                key={entry.name}
                scope="col"
                className="px-3 py-2 text-right font-semibold"
              >
                {entry.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={`${label}-${index}`} className="border-border border-t">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                {label}
              </th>
              {series.map((entry) => (
                <td
                  key={entry.name}
                  className="px-3 py-2 text-right [font-variant-numeric:tabular-nums]"
                >
                  {format(entry.values[index] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyPlot() {
  return (
    <div className="border-border text-muted-foreground mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed text-sm">
      No data for this period yet.
    </div>
  );
}
