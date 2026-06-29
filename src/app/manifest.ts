import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

/**
 * Web App Manifest — served by Next at /manifest.webmanifest and auto-injected
 * as <link rel="manifest"> into <head>. Grounded in the W3C Web App Manifest
 * spec (MDN). Keep theme_color as the single brand indigo (manifest spec has
 * no media-query support — the per-scheme theme colors live in viewport).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "en",
    dir: "ltr",
    background_color: "#fbfaf8",
    theme_color: "#4f46e5",
    categories: ["business", "productivity", "developer"],
    // Static assets in /public — these paths are independent of Next's
    // auto-injected <link> tags (icon.svg, apple-icon.tsx, favicon).
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    // Honest, real shortcuts to existing routes only — no marketing fluff.
    shortcuts: [
      {
        name: "Services",
        short_name: "Services",
        description:
          "Explore Bitecodes engineering, product, AI, and cloud services.",
        url: "/services",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Pricing",
        short_name: "Pricing",
        description: "Starting-from pricing for Bitecodes software services.",
        url: "/pricing",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Portfolio",
        short_name: "Portfolio",
        description: "Selected work and case studies from Bitecodes.",
        url: "/portfolio",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Contact",
        short_name: "Contact",
        description: "Start a conversation with Bitecodes.",
        url: "/contact",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
