import type { NextConfig } from "next";

// Security + privacy headers. Safe, high-value set that improves the
// Lighthouse "Best Practices" score without a strict CSP (which would risk
// breaking Next.js inline runtime / styled output).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Strip dev-only console output from the production bundle.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Modern image formats for any future next/image usage.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
  },
  // Trim client bundles by optimizing barrel imports from icon/animation libs.
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    // Hashed, immutable static assets (JS/CSS/font/media) — cache forever at
    // the edge and in the browser. Filenames are content-hashed, so a new
    // deploy ships new URLs and there is no stale-content risk.
    const immutableCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/_next/static/:path*", headers: immutableCache },
      // Security + privacy headers apply to every route, including HTML.
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
