import { startPairing } from "@/lib/server/desktop/devices";
import {
  clientContext,
  clientIpKey,
  desktopJson,
  readJsonObject,
  requestLocation,
  withDesktopErrors,
} from "@/lib/server/desktop/http";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { getSiteUrl } from "@/lib/server/env";

/**
 * POST /api/v1/desktop/pair — the desktop app starts a sign-in.
 *
 * Unauthenticated by design (the app has no credentials yet). It only creates
 * a short-lived pending record; nothing is usable until a signed-in user
 * approves it in the browser. Rate-limited per IP so it cannot be used to fill
 * the collection.
 */
export const dynamic = "force-dynamic";

export const POST = withDesktopErrors("pair", async (request: Request) => {
  const limit = await consumeNamedRateLimit(
    "desktopPair",
    clientIpKey(request),
  );
  if (!limit.allowed) {
    return desktopJson({ ok: false, code: "RATE_LIMITED" }, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }
  const body = (await readJsonObject(request, 2048)) ?? {};
  const pairing = await startPairing({
    label: body.label,
    ctx: clientContext(request),
    requestedFrom: requestLocation(request),
  });
  // Deliberately WITHOUT the code: the user types the code shown in their own
  // app, so a pairing link sent by someone else cannot be approved in one click.
  const verificationUrl = `${getSiteUrl()}/app/desktop`;
  return desktopJson({
    ok: true,
    deviceCode: pairing.deviceCode,
    userCode: pairing.userCode,
    verificationUrl,
    expiresAt: pairing.expiresAt.toISOString(),
    interval: pairing.intervalSeconds,
  });
});
