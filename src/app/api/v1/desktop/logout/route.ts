import { revokeDesktopToken } from "@/lib/server/desktop/devices";
import {
  bearerToken,
  clientContext,
  desktopJson,
} from "@/lib/server/desktop/http";

/** POST /api/v1/desktop/logout — the app signs out, revoking its own token. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (token) await revokeDesktopToken(token, clientContext(request));
  // Idempotent: signing out twice is not an error.
  return desktopJson({ ok: true });
}
