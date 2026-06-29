import { cn } from "@/lib/utils";

/** Derive 1–2 character initials from a technology name. */
function initials(name: string) {
  const words = name.replace(/[.]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Deterministic hue (0–360) from a string, for consistent per-tech color. */
function hueFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 360;
  }
  return h;
}

interface TechIconProps {
  name: string;
  slug: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-14 text-base",
};

/**
 * A premium lettermark tile for a technology. Pure CSS — no logo image
 * requests — so it stays fast, license-clean, and consistent in both themes.
 */
export function TechIcon({
  name,
  slug,
  className,
  size = "md",
}: TechIconProps) {
  const hue = hueFromString(slug);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-xl border font-semibold tracking-tight",
        sizeMap[size],
        className,
      )}
      style={{
        // Darkened text (L*0.42) keeps hue variety while passing WCAG AA on
        // white; the background is the same hue at low alpha for a soft tile.
        color: `oklch(0.42 0.16 ${hue})`,
        backgroundColor: `oklch(0.6 0.15 ${hue} / 0.1)`,
        borderColor: `oklch(0.6 0.15 ${hue} / 0.22)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
