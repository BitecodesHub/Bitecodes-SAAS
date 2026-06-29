import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded Open Graph image, generated at build time. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #0c0a14 0%, #14101f 55%, #0c0a14 100%)",
        padding: 80,
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "linear-gradient(135deg, #8b7cf6, #6366f1, #38bdf8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          {"</>"}
        </div>
        <div style={{ fontSize: 36, fontWeight: 600 }}>{siteConfig.name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Software, engineered with intent.
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            color: "#a7a3b8",
            maxWidth: 880,
          }}
        >
          Websites · Web &amp; enterprise apps · SaaS · APIs · AI automation
        </div>
      </div>

      <div style={{ fontSize: 26, color: "#8b87a0" }}>bitecodes.com</div>
    </div>,
    { ...size },
  );
}
