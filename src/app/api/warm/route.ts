import { getDatabase } from "@/lib/server/mongodb";

/**
 * Keeps a serverless instance and its database connection alive.
 *
 * This exists because of a measured problem, not a theoretical one. Warm, an
 * admin page answers in about 0.1s of server time. Cold, the first request to
 * the deployment measured **3.5 seconds**, and the first MongoDB connection —
 * TLS, SCRAM auth, and replica-set topology discovery against a shared-tier
 * cluster — measured a further 3.7s from a cold client. The admin panel is used
 * in short bursts with long gaps, so almost every visit landed on a cold
 * instance. That is the whole of "the admin panel feels slow": not queries, not
 * rendering, not the database having too much data in it (it has almost none).
 *
 * `getDatabase()` is the point of the handler. Touching the pool is what pays the
 * connection handshake in advance, on a request nobody is waiting for, so the
 * operator's first click does not pay it. Returning early without a query would
 * warm the function and leave the expensive half undone.
 *
 * Deliberately unauthenticated. It reveals nothing, writes nothing, and does one
 * `ping`, so a secret would only make it harder to point a free external cron at
 * it. It is still cheap enough to be uninteresting to abuse: the response is
 * fixed, and the work is a single round trip.
 *
 * Not a health check. It reports whether the pool could be reached, and nothing
 * about whether the application is correct — `/admin` has the real health panel.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A warm-up that hangs is worse than a cold start; fail fast instead. */
export const maxDuration = 15;

export async function GET() {
  const started = Date.now();
  let database: "ok" | "unreachable" = "ok";

  try {
    const db = await getDatabase();
    await db.command({ ping: 1 });
  } catch {
    // Swallowed on purpose: this endpoint's job is to warm, not to alarm. An
    // unreachable database is already surfaced by the admin health panel, and a
    // non-200 here would make an external monitor page somebody at 3am over a
    // transient blip in a warm-up ping.
    database = "unreachable";
  }

  return Response.json(
    { ok: true, database, ms: Date.now() - started },
    { headers: { "Cache-Control": "no-store" } },
  );
}
