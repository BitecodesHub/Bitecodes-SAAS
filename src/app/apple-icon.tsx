import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon + a raster brand mark (used as the Organization logo in
// JSON-LD, which search/AI engines parse more reliably than SVG).
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 96,
        fontWeight: 700,
        color: "white",
        background: "linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb)",
      }}
    >
      {"</>"}
    </div>,
    { ...size },
  );
}
