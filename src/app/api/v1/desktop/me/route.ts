import { ObjectId } from "mongodb";
import {
  recordRejectedToken,
  verifyDesktopToken,
} from "@/lib/server/desktop/devices";
import { getRouting } from "@/lib/server/desktop/providers";
import { adminUsers } from "@/lib/server/db/collections";
import {
  bearerToken,
  clientContext,
  desktopJson,
} from "@/lib/server/desktop/http";

/**
 * GET /api/v1/desktop/me — who the desktop app is signed in as, and whether the
 * Bitecodes model is available. Used for the app's "Signed in as …" line and to
 * detect a revoked token (401 → the app signs out).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = bearerToken(request);
  const ctx = clientContext(request);
  const device = await verifyDesktopToken(token, new Date(), ctx);
  if (!device) {
    await recordRejectedToken(token, ctx);
    return desktopJson({ ok: false, code: "UNAUTHORIZED" }, 401);
  }
  const user = ObjectId.isValid(device.userId)
    ? await (
        await adminUsers()
      ).findOne(
        { _id: new ObjectId(device.userId) },
        { projection: { email: 1, name: 1 } },
      )
    : null;
  const routing = await getRouting();
  return desktopJson({
    ok: true,
    user: { name: user?.name ?? null, email: user?.email ?? null },
    device: { label: device.label },
    assistant: { available: routing.enabled },
  });
}
