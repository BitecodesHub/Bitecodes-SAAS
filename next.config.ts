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
];

/**
 * Clickjacking protection, applied to every route **except** the hosted embeds.
 *
 * `/form/:formId` and `/book/:bookingId` exist precisely to be iframed by a
 * customer's own website, so a blanket `SAMEORIGIN` would break the product.
 * Both are safe to exempt: each renders one record the embedder already owns a
 * token for, holds no session, and performs no authenticated action, so there is
 * nothing for a hostile framer to hijack.
 */
const frameGuardHeader = { key: "X-Frame-Options", value: "SAMEORIGIN" };

/**
 * Routes that must never appear in a search index.
 *
 * `robots.txt` asks crawlers not to *crawl*; it does not stop a URL that leaks
 * some other way from being indexed. `X-Robots-Tag` is the instruction that
 * actually applies, and it also covers non-HTML responses (the tracking pixel,
 * JSON endpoints) where a `<meta name="robots">` tag cannot exist.
 *
 * Everything here is either private, personalised, or single-use:
 * the admin panel, per-prospect audit reports, unsubscribe and portal links,
 * onboarding flows, and email tracking endpoints.
 */
const noIndexPaths = [
  "/admin/:path*",
  "/report/:path*",
  "/unsubscribe",
  // The URI advertised in `List-Unsubscribe`. Covered too, because it is a real
  // URL that can end up in a forwarded email or a link scanner's logs.
  "/api/unsubscribe",
  "/portal/:path*",
  "/onboarding/:path*",
  "/e/:path*",
  // The hosted form embed: a customer's form, not Bitecodes content.
  "/form/:path*",
  // The hosted booking embed, for the same reason.
  "/book/:path*",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The MongoDB driver is a native-ish Node package; bundling it into the
  // server build is unnecessary work and can break its optional dependencies.
  serverExternalPackages: ["mongodb"],
  // Strip dev-only console noise from the production bundle — but NOT errors.
  //
  // This was `removeConsole: true`, which removes `console.error` too, and that
  // left production with no server-side error logging whatsoever. Every
  // diagnostic the code carefully writes — the chat gateway's upstream failures,
  // index-creation problems, a form notification that could not be queued — was
  // compiled away, so the platform logs showed nothing at all while things broke.
  //
  // It cost real time: a form submission stored correctly, charged a credit, and
  // never notified its owner, and there was no trace anywhere to say why. The
  // reason turned out to be that the reason itself had been stripped.
  //
  // `log`, `debug` and `info` still go, so casual output does not reach
  // production. `error` and `warn` are how the application reports that something
  // went wrong, and are kept.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  // Modern image formats for any future next/image usage.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
  },
  experimental: {
    // Trim client bundles by optimizing barrel imports from icon/animation libs.
    optimizePackageImports: ["lucide-react", "motion"],
    // Enables `unauthorized()` and `forbidden()`, used by the admin data-access
    // layer so an unauthenticated request renders the sign-in prompt instead of
    // relying on a hand-rolled redirect in every page.
    authInterrupts: true,
  },
  async headers() {
    // Next.js owns Cache-Control for its content-hashed assets. Overriding it
    // can break development and framework caching behavior.
    return [
      // Security + privacy headers apply to every route, including HTML.
      { source: "/:path*", headers: securityHeaders },
      // Frame protection everywhere the embeds do not live.
      { source: "/:path((?!form/|book/).*)", headers: [frameGuardHeader] },
      // The embeds instead declare that any site may frame them.
      // `frame-ancestors` also takes precedence over X-Frame-Options in modern
      // browsers, so this is belt-and-braces with the exclusion above.
      {
        source: "/form/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/book/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      ...noIndexPaths.map((source) => ({
        source,
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet",
          },
        ],
      })),
    ];
  },
};

export default nextConfig;
