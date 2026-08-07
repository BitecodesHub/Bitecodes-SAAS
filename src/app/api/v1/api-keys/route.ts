import { authenticateRequest, jsonOk } from "@/lib/server/chatbot/rest-auth";
import { listApiKeys } from "@/lib/server/chatbot/api-keys";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/api-keys — the owner's keys (metadata only; secrets are never
 * retrievable). Creating and revoking keys is done in the dashboard, not via
 * the API, so a leaked key cannot mint more keys.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, "read");
  if (!auth.ok) return auth.response;

  const keys = await listApiKeys(auth.key.ownerId);
  return jsonOk(
    keys.map((k) => ({
      id: k._id?.toHexString(),
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      status: k.status,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
    })),
  );
}
