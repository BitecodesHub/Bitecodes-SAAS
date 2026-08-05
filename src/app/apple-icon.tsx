import { ImageResponse } from "next/og";
import { brandMarkDataUri } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon + a raster brand mark (used as the Organization logo in
// JSON-LD, which search/AI engines parse more reliably than SVG). White plate
// behind the mark: iOS renders transparent touch icons on black, which would
// swallow a dark mark.
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      <img src={brandMarkDataUri("#111111")} width={134} height={134} alt="" />
    </div>,
    { ...size },
  );
}
