import { getIndexNowKey } from "@/lib/server/env";

/**
 * Serves the IndexNow verification key at a fixed, conflict-free path.
 *
 * IndexNow lets the key file live anywhere on the host as long as the submit
 * call names its `keyLocation`; a fixed path avoids a root-level dynamic route
 * (which would clash with the existing `[calculator]` slug and shadow the 404
 * page). 404s when no key is configured.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = getIndexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
