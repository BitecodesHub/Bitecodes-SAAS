/**
 * The Bitecodes brand mark: a bold "B" with a bite taken out of the top-left
 * corner (crumb included) and a "</>" cut out of the body.
 *
 * Single source of geometry for every rendering of the mark — the React
 * `<Logo>` component, Open Graph images, and `scripts/gen-icons.py` (which
 * mirrors these numbers; keep them in step). Everything is built from
 * primitives inside a mask, so the mark renders in any single colour on a
 * transparent background.
 */

export const BRAND_MARK_VIEWBOX = "0 0 100 100";

/** The solid B body, before the bite and glyphs are cut out. */
export const BRAND_BODY_PATH =
  "M18 96 L18 8 L54 8 C78 8 90 18 90 31 C90 43 77 50 60 50.5 L53 51 " +
  "C81 52 96 61 96 75 C96 89 81 96 58 96 Z";

/** Circles subtracted from the top-left corner — the bite. */
export const BRAND_BITE_CIRCLES = [
  { cx: 19, cy: 16, r: 15 },
  { cx: 34, cy: 9, r: 8 },
] as const;

/** The crumb floating in the bite. Drawn in the mark colour, outside the body. */
export const BRAND_CRUMB = { cx: 9.5, cy: 36, r: 3.8 } as const;

/** "</>" cut out of the body as strokes. */
export const BRAND_GLYPH_STROKE_WIDTH = 5.5;
export const BRAND_GLYPH_PATHS = [
  "M41 48 L30.5 56.5 L41 65",
  "M55 48 L65.5 56.5 L55 65",
  "M50.5 44.5 L42.5 68.5",
] as const;

/**
 * A standalone SVG document of the mark.
 *
 * @param color mark colour (any CSS colour)
 * @param options.background optional opaque plate behind the mark, with
 *   `radius` corners — used for icons that must stay legible on any surface.
 */
export function brandMarkSvg(
  color: string,
  options: { background?: string; radius?: number } = {},
): string {
  const bite = BRAND_BITE_CIRCLES.map(
    (c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="#000"/>`,
  ).join("");
  const glyphs = BRAND_GLYPH_PATHS.map((d) => `<path d="${d}"/>`).join("");
  const plate = options.background
    ? `<rect width="100" height="100" rx="${options.radius ?? 0}" fill="${options.background}"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}">` +
    `<mask id="bite"><path d="${BRAND_BODY_PATH}" fill="#fff"/>${bite}` +
    `<g stroke="#000" stroke-width="${BRAND_GLYPH_STROKE_WIDTH}" fill="none">${glyphs}</g></mask>` +
    plate +
    `<rect width="100" height="100" fill="${color}" mask="url(#bite)"/>` +
    `<circle cx="${BRAND_CRUMB.cx}" cy="${BRAND_CRUMB.cy}" r="${BRAND_CRUMB.r}" fill="${color}"/>` +
    `</svg>`
  );
}

/** The mark as a data URI, for `<img>` inside Open Graph ImageResponses. */
export function brandMarkDataUri(
  color: string,
  options?: { background?: string; radius?: number },
): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg(color, options))}`;
}
