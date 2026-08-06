import "server-only";

import { verifyApiKey, type VerifiedKey } from "@/lib/server/chatbot/api-keys";

/**
 * Bearer-key authentication for the public `/api/v1` REST surface.
 *
 * Resolves the owner behind an `Authorization: Bearer sk_live_…` header. On
 * failure it returns a ready-made JSON 401/403 so route handlers stay a single
 * line of guard. Scopes gate which endpoints a key may call.
 */

export function jsonError(
  status: number,
  code: string,
  message: string,
): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type AuthOutcome =
  | { ok: true; key: VerifiedKey }
  | { ok: false; response: Response };

/** Verifies the request's Bearer key, optionally requiring a scope. */
export async function authenticateRequest(
  request: Request,
  requiredScope?: string,
): Promise<AuthOutcome> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const secret = match?.[1];

  const key = await verifyApiKey(secret);
  if (!key) {
    return {
      ok: false,
      response: jsonError(401, "unauthorized", "Missing or invalid API key."),
    };
  }
  if (requiredScope && !key.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: jsonError(
        403,
        "forbidden",
        `This key lacks the '${requiredScope}' scope.`,
      ),
    };
  }
  return { ok: true, key };
}
