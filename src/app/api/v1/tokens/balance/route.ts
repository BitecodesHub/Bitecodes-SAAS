import { authenticateRequest, jsonOk } from "@/lib/server/chatbot/rest-auth";
import { getBalance } from "@/lib/server/tokens-ledger/ledger";

export const dynamic = "force-dynamic";

/** GET /api/v1/tokens/balance — the owner's remaining token balance. */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, "read");
  if (!auth.ok) return auth.response;

  const remaining = await getBalance(auth.key.ownerId);
  return jsonOk({ remaining });
}
