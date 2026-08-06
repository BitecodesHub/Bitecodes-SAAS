import type { NextRequest } from "next/server";
import { processWebhook } from "@/lib/server/billing/webhook";

/**
 * The payment gateway's callback.
 *
 * Reads the body as raw text, because a signature covers the exact bytes sent —
 * parsing to JSON and re-serialising would change them and break verification.
 *
 * Always answers 200 for anything verified, including duplicates and events we
 * do not act on: a gateway treats a non-2xx as failure and retries, so a
 * "correctly ignored" event returned as an error would be redelivered forever.
 * Only an unverifiable signature gets a 400.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let outcome;
  try {
    outcome = await processWebhook(rawBody, request.headers);
  } catch (error) {
    console.error(
      "[billing] Webhook processing failed:",
      error instanceof Error ? error.message : error,
    );
    // A 500 asks the gateway to retry, which is what we want for a transient
    // database failure — the idempotency guard makes the retry safe.
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (outcome.kind === "unverified") {
    return new Response(JSON.stringify({ ok: false, error: "bad signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, outcome: outcome.kind }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
