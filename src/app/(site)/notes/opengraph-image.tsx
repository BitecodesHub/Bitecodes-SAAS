import { renderOgImage, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Notes — free AI desktop assistant for Mac and Windows";

export default async function Image() {
  return renderOgImage({
    eyebrow: "Free desktop app · macOS & Windows",
    title: "Notes — your AI assistant, on your desktop",
    subtitle:
      "Explain anything on screen, chat and voice. Free with a Bitecodes account.",
  });
}
