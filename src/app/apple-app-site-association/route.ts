import {
  APPLE_APP_SITE_ASSOCIATION,
  aasaResponseInit,
} from "@/lib/app-association";

// Apple Universal Links association file, served at /apple-app-site-association.
// A route handler is REQUIRED (not a static public file) because Next serves
// the extensionless static file as application/octet-stream, which Apple
// rejects. Mirrors the /.well-known/apple-app-site-association sibling handler
// (Apple checks .well-known first, then the root) — both import the same BODY.
export const dynamic = "force-static";

export function GET() {
  return new Response(APPLE_APP_SITE_ASSOCIATION, aasaResponseInit);
}
