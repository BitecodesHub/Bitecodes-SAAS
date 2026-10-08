import { pollPairing } from "@/lib/server/desktop/devices";
import {
  clientContext,
  clientIpKey,
  desktopJson,
  readJsonObject,
} from "@/lib/server/desktop/http";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";

/**
 * POST /api/v1/desktop/pair/poll — the app checks whether its pairing was
 * approved. The secret device code is the credential here; the response carries
 * the device token exactly once.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = await consumeNamedRateLimit(
    "desktopPoll",
    clientIpKey(request),
  );
  if (!limit.allowed) {
    return desktopJson({ ok: false, code: "RATE_LIMITED" }, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }
  const body = await readJsonObject(request, 1024);
  const deviceCode =
    typeof body?.deviceCode === "string" ? body.deviceCode : "";
  const result = await pollPairing(
    deviceCode,
    new Date(),
    clientContext(request),
  );
  switch (result.status) {
    case "approved":
      return desktopJson({
        ok: true,
        status: "approved",
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      });
    case "pending":
      return desktopJson({ ok: true, status: "pending" }, 202);
    case "denied":
      return desktopJson({ ok: false, status: "denied" }, 403);
    default:
      return desktopJson({ ok: false, status: "expired" }, 410);
  }
}
