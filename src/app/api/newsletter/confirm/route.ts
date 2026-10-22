import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { confirmSubscriber } from "@/lib/server/newsletter/subscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/newsletter/confirm?token=…
 *
 * Verifies the signed HMAC token issued during sign-up, marks the subscriber
 * as confirmed, and redirects to the public confirmation page with a status
 * query parameter so the page can show the right message.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const result = await confirmSubscriber(token);

  if (result.status === "confirmed" || result.status === "already") {
    redirect(`/newsletter/confirm?status=ok`);
  }

  redirect(`/newsletter/confirm?status=invalid`);
}
