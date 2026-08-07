import {
  authenticateRequest,
  jsonError,
  jsonOk,
} from "@/lib/server/chatbot/rest-auth";
import { getBalance } from "@/lib/server/wallet/wallet";
import type { WalletProduct } from "@/lib/server/db/types";

export const dynamic = "force-dynamic";

const PRODUCTS: WalletProduct[] = ["chatbot", "forms"];

/**
 * GET /api/v1/credits/balance?product=forms|chatbot
 *
 * The product-aware successor to `/api/v1/tokens/balance`, which stays as a
 * chatbot-only alias so existing integrations keep working.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, "read");
  if (!auth.ok) return auth.response;

  const requested =
    new URL(request.url).searchParams.get("product") ?? "chatbot";
  if (!PRODUCTS.includes(requested as WalletProduct)) {
    return jsonError(
      422,
      "validation",
      `product must be one of: ${PRODUCTS.join(", ")}.`,
    );
  }
  const product = requested as WalletProduct;

  return jsonOk({
    product,
    remaining: await getBalance(auth.key.ownerId, product),
  });
}
