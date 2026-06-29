import {
  APPLE_APP_SITE_ASSOCIATION,
  aasaResponseInit,
} from "@/lib/app-association";

// Apple Universal Links — /.well-known/apple-app-site-association.
// Apple checks this path first, then /apple-app-site-association. Both must
// return a direct 200 with Content-Type: application/json (no redirects), so
// this is a route handler rather than a static file. BODY is shared.
export const dynamic = "force-static";

export function GET() {
  return new Response(APPLE_APP_SITE_ASSOCIATION, aasaResponseInit);
}
