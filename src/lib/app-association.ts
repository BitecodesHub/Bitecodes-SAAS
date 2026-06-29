/**
 * Apple App-Site-Association (Universal Links) JSON.
 *
 * Shared by two route handlers so Apple can fetch it from both
 *   /apple-app-site-association            and
 *   /.well-known/apple-app-site-association
 * (iOS checks /.well-known/ first, then the root). Both must return a direct
 * 200 with Content-Type: application/json — no redirects — which is why this
 * is a route handler rather than a static public/ file (Next serves
 * extensionless public files as application/octet-stream, which Apple rejects).
 *
 * TODO(client): replace TEAMID with the real 10-char Apple Developer Team ID
 * (Apple Developer > Membership > Team ID) and com.bitecodes.app with the real
 * bundle ID before shipping universal links.
 */
export const APPLE_APP_SITE_ASSOCIATION = JSON.stringify(
  {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ["TEAMID.com.bitecodes.app"],
          components: [
            { "/": "/services/*", comment: "Service detail pages" },
            { "/": "/blog/*", comment: "Blog post pages" },
            { "/": "/portfolio/*", comment: "Portfolio case-study pages" },
            { "/": "/contact", comment: "Contact page" },
            { "/": "/pricing", comment: "Pricing page" },
            { "/": "/", comment: "Home page" },
            {
              "/": "/thank-you",
              exclude: true,
              comment: "Keep form thank-you in the browser",
            },
          ],
        },
      ],
    },
  },
  null,
  2,
);

export const aasaResponseInit: ResponseInit = {
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=86400, must-revalidate",
  },
};
