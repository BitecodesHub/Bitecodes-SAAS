import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Shared branded Open Graph image used by per-page opengraph-image routes.
 * Light, minimalist card: warm-white canvas, indigo accent, editorial layout.
 */
export function renderOgImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fbfaf8",
        color: "#1a1a22",
        fontFamily: "sans-serif",
        padding: 80,
        position: "relative",
      }}
    >
      {/* Hairline frame */}
      <div
        style={{
          position: "absolute",
          inset: 40,
          border: "1px solid #ece9e4",
          borderRadius: 28,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#4f46e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {"</>"}
        </div>
        <div style={{ fontSize: 32, fontWeight: 600 }}>{siteConfig.name}</div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#4f46e5",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 66,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            maxWidth: 1000,
            color: "#1a1a22",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              fontSize: 28,
              color: "#6b6b76",
              maxWidth: 920,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div style={{ fontSize: 24, color: "#8a8a94", position: "relative" }}>
        bitecodes.com
      </div>
    </div>,
    { ...OG_SIZE },
  );
}
